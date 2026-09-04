export function productLinePrice(product, quantity) {
  const exact = (product?.packPrices || []).find((pack) => Number(pack.quantity) === quantity);
  if (exact) return exact.price;
  if (quantity === 3 && ['liver-fix', 'karela-jamun-fizz'].includes(product?.slug)) return null;
  return product?.unitPrice == null ? null : Math.round(product.unitPrice * quantity * 100) / 100;
}
