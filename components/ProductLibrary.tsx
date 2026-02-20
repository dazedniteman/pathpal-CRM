
import React, { useState } from 'react';
import { Product, ContactProduct, Contact } from '../types';
import { ProductModal } from './ProductModal';

interface ProductLibraryProps {
  products: Product[];
  contacts: Contact[];
  contactProducts: ContactProduct[]; // all contact-product links across all contacts
  onCreateProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  onUpdateProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
}

const EmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="w-16 h-16 rounded-2xl bg-base-700 flex items-center justify-center mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    </div>
    <h3 className="text-base font-semibold text-text-primary mb-1">No products yet</h3>
    <p className="text-sm text-text-muted mb-6 max-w-xs">
      Add your products to reference them in emails and link them to contacts.
    </p>
    <button
      onClick={onAdd}
      className="flex items-center gap-2 px-4 py-2 bg-outreach hover:bg-outreach-light text-white rounded-lg text-sm font-semibold transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      Add First Product
    </button>
  </div>
);

interface ProductCardProps {
  product: Product;
  linkedContactCount: number;
  onClick: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, linkedContactCount, onClick }) => (
  <button
    onClick={onClick}
    className="group relative bg-base-800 border border-base-600 rounded-xl p-5 text-left hover:border-base-500 hover:bg-base-750 transition-all duration-150 flex flex-col gap-3"
  >
    {/* Status badge */}
    {!product.isActive && (
      <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full bg-base-700 text-text-muted border border-base-600">
        Inactive
      </span>
    )}

    {/* Photo / placeholder */}
    <div className="w-full h-32 rounded-lg overflow-hidden bg-base-700 flex items-center justify-center border border-base-600">
      {product.photoUrl ? (
        <img
          src={product.photoUrl}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-base-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )}
    </div>

    {/* Name */}
    <div>
      <h3 className="text-sm font-semibold text-text-primary group-hover:text-white transition-colors">{product.name}</h3>
      {product.description && (
        <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">{product.description}</p>
      )}
    </div>

    {/* Stats */}
    <div className="flex items-center gap-3 mt-auto pt-1 border-t border-base-700">
      <div className="flex items-center gap-1.5 text-xs text-text-muted">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>{linkedContactCount} contact{linkedContactCount !== 1 ? 's' : ''}</span>
      </div>
      {product.aiContext && (
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span>AI context set</span>
        </div>
      )}
      {/* Edit hint */}
      <div className="ml-auto text-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit
      </div>
    </div>
  </button>
);

export const ProductLibrary: React.FC<ProductLibraryProps> = ({
  products,
  contacts,
  contactProducts,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
}) => {
  const [modalProduct, setModalProduct] = useState<Product | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openCreate = () => {
    setModalProduct(undefined);
    setIsModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setModalProduct(product);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalProduct(undefined);
  };

  const handleSave = async (payload: Omit<Product, 'id'> | Product) => {
    if ('id' in payload) {
      await onUpdateProduct(payload as Product);
    } else {
      await onCreateProduct(payload as Omit<Product, 'id'>);
    }
  };

  // Count contacts linked to each product
  const linkedCountByProduct: Record<string, number> = {};
  for (const cp of contactProducts) {
    linkedCountByProduct[cp.productId] = (linkedCountByProduct[cp.productId] || 0) + 1;
  }

  // Sort: active first, then by name
  const sorted = [...products].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-600 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Product Library</h1>
          <p className="text-xs text-text-muted mt-0.5">
            {products.length} product{products.length !== 1 ? 's' : ''} · Link to contacts and inject AI context
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-outreach hover:bg-outreach-light text-white rounded-lg text-sm font-semibold transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Product
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {products.length === 0 ? (
          <EmptyState onAdd={openCreate} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                linkedContactCount={linkedCountByProduct[product.id] || 0}
                onClick={() => openEdit(product)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <ProductModal
          product={modalProduct}
          onSave={handleSave}
          onDelete={modalProduct ? onDeleteProduct : undefined}
          onClose={closeModal}
        />
      )}
    </div>
  );
};
