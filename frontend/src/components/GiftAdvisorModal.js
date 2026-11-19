import React, { useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '../api';

// This is the standalone AI Gift Advisor component.
function GiftAdvisorModal({ products, onClose, onProductSelect }) {
    const [occasion, setOccasion] = useState("");
    const [recipient, setRecipient] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleFindGift = async () => {
        if (!occasion || !recipient) {
            setError("Please fill out both fields to get suggestions.");
            return;
        }
        setError(null);
        setIsLoading(true);
        setSuggestions([]);

        try {
            // The AI call runs on our backend so no API key is exposed in the browser.
            const res = await apiFetch(`/api/ai/gift-advice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ occasion, recipient }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            const recommendedProducts = (data.recommendations || [])
                .map(rec => {
                    const fullProduct = products.find(p => p._id === rec.productId);
                    return fullProduct ? { ...fullProduct, reasoning: rec.reasoning } : null;
                })
                .filter(Boolean);

            if (recommendedProducts.length > 0) {
                setSuggestions(recommendedProducts);
            } else {
                setError("I couldn't find a suitable gift based on your description. Please try being more specific!");
            }

        } catch (err) {
            console.error("Gift advisor request failed:", err);
            setError("Sorry, I'm having trouble thinking of a gift right now. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="ai-modal-content" onClick={e => e.stopPropagation()}>
                 <button className="modal-close-btn" onClick={onClose} aria-label="Close gift advisor">
                    <X size={28} />
                 </button>
                 <div className="ai-modal-header">
                     <h2 className="ai-modal-title">✨ AI Gift Advisor ✨</h2>
                     <p className="ai-modal-subtitle">Tell me about the person you're shopping for, and I'll find the perfect handmade gift!</p>
                 </div>
                 <div className="ai-modal-body">
                     <div className="ai-input-group">
                         <label htmlFor="occasion">What's the Occasion?</label>
                         <input
                             id="occasion"
                             type="text"
                             placeholder="e.g., Birthday, Anniversary, Thank You"
                             value={occasion}
                             onChange={e => setOccasion(e.target.value)}
                         />
                     </div>
                     <div className="ai-input-group">
                         <label htmlFor="recipient">Describe the person:</label>
                         <textarea
                             id="recipient"
                             placeholder="e.g., 'My mom, who loves gardening and drinking tea.'"
                             value={recipient}
                             onChange={e => setRecipient(e.target.value)}
                             rows="3"
                         ></textarea>
                     </div>
                     <button className="ai-modal-btn" onClick={handleFindGift} disabled={isLoading}>
                         {isLoading ? "Thinking..." : "Find a Gift ✨"}
                     </button>
                     {error && <p className="ai-error-message">{error}</p>}
                     <div className="ai-suggestions-container">
                         {suggestions.map((product, index) => (
                             <div key={index} className="ai-suggestion-card" onClick={() => onProductSelect(product)}>
                                 <img src={product.imageUrl} alt={product.name} className="ai-suggestion-image" />
                                 <div className="ai-suggestion-details">
                                     <h4 className="ai-suggestion-name">{product.name}</h4>
                                     <p className="ai-suggestion-reasoning"><strong>Why it's a great gift:</strong> {product.reasoning}</p>
                                     <p className="ai-suggestion-price">₹{product.price}</p>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
            </div>
        </div>
    );
};

export default GiftAdvisorModal;

