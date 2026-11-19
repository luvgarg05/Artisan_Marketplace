import express from "express";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { requireAuth, requireSelf } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

const SELLER_STATUSES = ["Pending", "Confirmed", "Packed", "Shipped", "Delivered", "Cancelled", "Rejected"];
const RESTOCK_STATUSES = ["Cancelled", "Rejected"];
const ISSUE_TYPES = ["not_received", "damaged", "wrong_item", "incomplete", "other"];

// Puts stock back for a list of { productId, quantity } items.
async function restock(items) {
    await Promise.all(items.map(({ productId, quantity }) =>
        Product.updateOne({ _id: productId }, { $inc: { quantity } })
    ));
}

// Create orders from a checkout. One checkout becomes one order per seller.
// Prices, names and sellers are read from the database, never trusted from the client.
router.post("/create", async (req, res) => {
    const reserved = []; // stock already taken, so it can be returned if something fails
    try {
        const { products, shippingAddress, paymentMethod } = req.body;

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ message: "Your order has no items." });
        }
        if (!paymentMethod) {
            return res.status(400).json({ message: "Please choose a payment method." });
        }

        // Merge duplicate lines and validate quantities.
        const requested = new Map();
        for (const item of products) {
            const quantity = Number(item.quantity);
            if (!mongoose.isValidObjectId(item.productId) || !Number.isInteger(quantity) || quantity < 1) {
                return res.status(400).json({ message: "Invalid item in order." });
            }
            requested.set(item.productId, (requested.get(item.productId) || 0) + quantity);
        }

        const dbProducts = await Product.find({ _id: { $in: [...requested.keys()] } })
            .populate("sellerId", "isShopOpen");
        if (dbProducts.length !== requested.size) {
            return res.status(400).json({ message: "Some items in your order no longer exist." });
        }

        for (const product of dbProducts) {
            if (!product.sellerId || product.sellerId.isShopOpen === false) {
                return res.status(400).json({ message: `"${product.name}" is currently unavailable.` });
            }
            if (product.sellerId._id.toString() === req.userId) {
                return res.status(400).json({ message: `You can't buy your own product ("${product.name}").` });
            }
        }

        // Reserve stock atomically: the update only succeeds if enough quantity is left.
        for (const product of dbProducts) {
            const quantity = requested.get(product._id.toString());
            const updated = await Product.findOneAndUpdate(
                { _id: product._id, quantity: { $gte: quantity } },
                { $inc: { quantity: -quantity } }
            );
            if (!updated) {
                await restock(reserved);
                return res.status(409).json({
                    message: `Only ${product.quantity} left of "${product.name}". Please reduce the quantity.`,
                });
            }
            reserved.push({ productId: product._id, quantity });
        }

        // Group lines by seller.
        const ordersBySeller = {};
        for (const product of dbProducts) {
            const sellerId = product.sellerId._id.toString();
            (ordersBySeller[sellerId] ||= []).push({
                productId: product._id,
                name: product.name,
                price: product.price,
                quantity: requested.get(product._id.toString()),
                imageUrl: product.imageUrl,
                sellerId,
            });
        }

        const createdOrders = await Order.insertMany(
            Object.entries(ordersBySeller).map(([sellerId, lines]) => ({
                buyerId: req.userId,
                sellerId,
                products: lines,
                totalAmount: lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
                shippingAddress,
                paymentMethod,
                status: "Pending",
            }))
        );

        res.status(201).json({ message: "Orders created successfully!", orders: createdOrders });
    } catch (err) {
        console.error("Error creating order:", err);
        if (reserved.length) await restock(reserved).catch(() => {});
        res.status(500).json({ message: "Server error while creating order." });
    }
});

// Orders placed by the logged-in buyer
router.get("/by-buyer/:buyerId", requireSelf("buyerId"), async (req, res) => {
    try {
        const orders = await Order.find({ buyerId: req.params.buyerId })
            .populate("sellerId", "shopName phone")
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        console.error("Error fetching buyer's orders:", err);
        res.status(500).json({ message: "Server error while fetching orders." });
    }
});

// Orders received by the logged-in seller
router.get("/by-seller/:sellerId", requireSelf("sellerId"), async (req, res) => {
    try {
        const orders = await Order.find({ sellerId: req.params.sellerId })
            .populate("buyerId", "name")
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        console.error("Error fetching seller's orders:", err);
        res.status(500).json({ message: "Server error while fetching seller's orders." });
    }
});

// Count of pending orders for the logged-in seller
router.get("/pending-count/:sellerId", requireSelf("sellerId"), async (req, res) => {
    try {
        const count = await Order.countDocuments({ sellerId: req.params.sellerId, status: "Pending" });
        res.json({ count });
    } catch (err) {
        console.error("Error fetching pending order count:", err);
        res.status(500).json({ message: "Server error while fetching count." });
    }
});

// Seller updates the status of one of their own orders
router.put("/update-status/:orderId", async (req, res) => {
    try {
        const { status } = req.body;
        if (!SELLER_STATUSES.includes(status)) {
            return res.status(400).json({ message: "Invalid order status." });
        }

        const order = await Order.findById(req.params.orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }
        if (order.sellerId.toString() !== req.userId) {
            return res.status(403).json({ message: "Only the seller can update this order." });
        }

        const wasActive = !RESTOCK_STATUSES.includes(order.status);
        order.status = status;
        await order.save();

        // Cancelling or rejecting an order returns its items to stock.
        if (wasActive && RESTOCK_STATUSES.includes(status)) {
            await restock(order.products.map((p) => ({ productId: p.productId, quantity: p.quantity })));
        }

        res.json({ message: "Order status updated!", order });
    } catch (err) {
        console.error("Error updating order status:", err);
        res.status(500).json({ message: "Server error while updating status." });
    }
});

// Buyer reports a delivery issue on one of their own orders
router.put("/report-issue/:orderId", async (req, res) => {
    try {
        const { issueType, issueDescription } = req.body;
        if (!ISSUE_TYPES.includes(issueType)) {
            return res.status(400).json({ message: "Invalid issue type." });
        }

        const order = await Order.findOneAndUpdate(
            { _id: req.params.orderId, buyerId: req.userId },
            {
                hasDeliveryIssue: true,
                issueType,
                issueDescription: issueDescription || "",
                buyerResolved: false,
                sellerResolved: false,
            },
            { new: true }
        );
        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }
        res.json({ message: "Delivery issue reported successfully!", order });
    } catch (err) {
        console.error("Error reporting delivery issue:", err);
        res.status(500).json({ message: "Server error while reporting issue." });
    }
});

// Buyer or seller marks an issue as resolved from their side.
// Which side is decided by who is logged in, not by the request body.
router.put("/resolve-issue/:orderId", async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }

        if (order.buyerId.toString() === req.userId) {
            order.buyerResolved = true;
        } else if (order.sellerId.toString() === req.userId) {
            order.sellerResolved = true;
        } else {
            return res.status(403).json({ message: "You are not part of this order." });
        }

        if (order.buyerResolved && order.sellerResolved) {
            order.hasDeliveryIssue = false;
        }
        await order.save();

        res.json({ message: "Issue resolution updated!", order });
    } catch (err) {
        console.error("Error resolving issue:", err);
        res.status(500).json({ message: "Server error while resolving issue." });
    }
});

// Count of unresolved delivery issues for the logged-in seller
router.get("/issues-count/:sellerId", requireSelf("sellerId"), async (req, res) => {
    try {
        const count = await Order.countDocuments({
            sellerId: req.params.sellerId,
            hasDeliveryIssue: true,
            $or: [{ buyerResolved: false }, { sellerResolved: false }],
        });
        res.json({ count });
    } catch (err) {
        console.error("Error fetching issues count:", err);
        res.status(500).json({ message: "Server error while fetching count." });
    }
});

export default router;
