import { useEffect, useRef, useState } from 'react';
import { api } from './api';

export default function ProductPricingEditor({ product, onSaved, onClose }) {
  const dialog = useRef(null);
  const quantities = ['liver-fix', 'karela-jamun-fizz'].includes(product.slug) ? [1, 3] : [1];
  const [prices, setPrices] = useState(() => Object.fromEntries(quantities.map((quantity) => [quantity,
    product.packPrices?.find((pack) => pack.quantity === quantity)?.price ?? (quantity === 1 ? product.unitPrice : '') ?? '',
  ])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current.showModal(); }, []);

  async function save(event) {
    event.preventDefault();
    setError(''); setSaving(true);
    try {
      const quantityPrices = quantities.filter((quantity) => prices[quantity] !== '').map((quantity) => ({ quantity, price: Number(prices[quantity]) }));
      const response = await api.updateProductPricing(product._id, quantityPrices);
      onSaved(response.product);
    } catch (failure) { setError(failure.message); }
    finally { setSaving(false); }
  }

  return <dialog ref={dialog} className="product-pricing-dialog" onCancel={(event) => { if (saving) event.preventDefault(); else onClose(); }} aria-labelledby="product-pricing-title">
    <form onSubmit={save}>
      <div className="pack-editor-heading"><span className="pack-editor-kicker">PRODUCT PRICING</span><button type="button" className="icon-button" disabled={saving} onClick={onClose} aria-label="Close pricing editor">×</button></div>
      <div className="pack-editor-product">{product.image && <img src={product.image} alt=""/>}<div><h2 id="product-pricing-title">{product.name}</h2><p>Set the original value shown in your kits.</p></div></div>
      <div className="pack-price-fields">{quantities.map((quantity) => <label className="pack-price-field" key={quantity}>
        <span className="pack-quantity-badge">{quantity === 1 ? 'SINGLE UNIT' : '3-UNIT PACK'}</span>
        <strong>{quantity === 1 ? '1 quantity' : '3 quantity'}</strong>
        <span className="pack-money-input"><b>₹</b><input autoFocus={quantity === 1} aria-label={`Total price for ${quantity} quantity`} type="number" min="0.01" step="0.01" required={quantity === 1} value={prices[quantity]} disabled={saving} placeholder="Set total" onChange={(event) => setPrices({ ...prices, [quantity]: event.target.value })}/></span>
        <small>{quantity === 1 ? 'Total for one unit' : 'Total for all three units together'}</small>
      </label>)}</div>
      <p className="pack-editor-note">{quantities.length > 1 ? 'The 3-unit pack has its own price. Enter the complete pack value here. ' : ''}These prices apply across all kits containing this product. Set the final kit price separately in the kit editor.</p>
      {error && <p className="pack-editor-error" role="alert">{error}</p>}
      <footer className="pack-editor-footer"><button type="button" className="secondary-button" disabled={saving} onClick={onClose}>Cancel</button><button className="save-button" disabled={saving}>{saving ? 'Saving…' : 'Save product prices'}</button></footer>
    </form>
  </dialog>;
}
