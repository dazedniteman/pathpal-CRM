
import React, { useState } from 'react';
import { Product } from '../types';

interface ProductModalProps {
  product?: Product;
  onSave: (product: Omit<Product, 'id'> | Product) => Promise<void>;
  onDelete?: (productId: string) => Promise<void>;
  onClose: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({ product, onSave, onDelete, onClose }) => {
  const isEdit = !!product;

  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [photoUrl, setPhotoUrl] = useState(product?.photoUrl || '');
  const [aiContext, setAiContext] = useState(product?.aiContext || '');
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Product name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { name: name.trim(), description, photoUrl, aiContext, isActive };
      if (isEdit && product) {
        await onSave({ ...product, ...payload });
      } else {
        await onSave(payload);
      }
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!product || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(product.id);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to delete product.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-base-800 border border-base-600 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-600">
          <h2 className="text-base font-semibold text-text-primary">
            {isEdit ? 'Edit Product' : 'New Product'}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Product name */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Product Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. The PathPal"
              className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-outreach transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of the product..."
              rows={3}
              className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-outreach transition-colors resize-none"
            />
          </div>

          {/* Photo URL */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Photo URL</label>
            <input
              type="url"
              value={photoUrl}
              onChange={e => setPhotoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-outreach transition-colors"
            />
            {photoUrl && (
              <div className="mt-2">
                <img
                  src={photoUrl}
                  alt="Product preview"
                  className="w-20 h-20 rounded-lg object-cover border border-base-600"
                  onError={e => (e.currentTarget.style.display = 'none')}
                />
              </div>
            )}
          </div>

          {/* AI Context */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              AI Context
              <span className="ml-1.5 text-text-muted font-normal">(injected into Gemini email prompts)</span>
            </label>
            <textarea
              value={aiContext}
              onChange={e => setAiContext(e.target.value)}
              placeholder="e.g. PathPal is a portable putting aid that helps golfers practice alignment and stroke mechanics at home. Price: $49. Key benefits: compact, travel-friendly, used by PGA Tour players."
              rows={5}
              className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-outreach transition-colors resize-none font-mono text-xs leading-relaxed"
            />
            <p className="mt-1 text-xs text-text-muted">This text is added to every AI email draft for contacts linked to this product.</p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-sm font-medium text-text-primary">Active</div>
              <div className="text-xs text-text-muted mt-0.5">Inactive products are hidden from pickers but not deleted</div>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? 'bg-outreach' : 'bg-base-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-base-600 flex items-center justify-between gap-3">
          <div>
            {isEdit && onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Delete this product?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors"
                  >
                    {deleting ? 'Deleting...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs px-2 py-1 bg-base-700 hover:bg-base-600 text-text-secondary rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Delete product
                </button>
              )
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-base-700 hover:bg-base-600 text-text-secondary hover:text-text-primary rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-4 py-2 bg-outreach hover:bg-outreach-light text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
