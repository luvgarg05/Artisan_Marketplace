import express from "express";
import Product from "../models/Product.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET all products for the home screen
router.get("/all", async (req, res) => {
    try {
        const products = await Product.find({})
            .populate('sellerId', 'name shopName isShopOpen') // Also get the shop status
            .sort({ createdAt: -1 });

        // Fisher-Yates shuffle (sorting with a random comparator gives a biased order)
        for (let i = products.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [products[i], products[j]] = [products[j], products[i]];
        }
        res.json(products);
    } catch (err) {
        console.error("Error fetching all products:", err);
        res.status(500).json({ message: "Server error while fetching products." });
    }
});

// GET all products for a specific seller
router.get("/by-seller/:sellerId", async (req, res) => {
    try {
        const products = await Product.find({ sellerId: req.params.sellerId })
            .sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        console.error("Error fetching seller's products:", err);
        res.status(500).json({ message: "Server error while fetching seller's products." });
    }
});

// Add a new product for the logged-in seller
router.post("/add", requireAuth, async (req, res) => {
    try {
        const { name, description, price, quantity, imageUrl } = req.body;

        // Validate and convert data types before saving.
        const numericPrice = Number(price);
        const numericQuantity = Number(quantity);

        if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
            return res.status(400).json({ message: "Price must be a number greater than 0." });
        }
        if (!Number.isInteger(numericQuantity) || numericQuantity < 0) {
            return res.status(400).json({ message: "Quantity must be a whole number (0 or more)." });
        }

        const newProduct = new Product({
            name,
            description,
            price: numericPrice,
            quantity: numericQuantity,
            imageUrl,
            sellerId: req.userId,
        });

        await newProduct.save();
        res.status(201).json({ message: "Product added successfully!", product: newProduct });

    } catch (err) {
        console.error("--- ERROR ADDING PRODUCT ---");
        console.error("Error Message:", err.message);
        res.status(500).json({ message: "Server error while adding product." });
    }
});

export default router;
