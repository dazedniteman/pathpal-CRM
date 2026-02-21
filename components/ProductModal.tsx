
import React, { useState, useRef } from 'react';
import { Product } from '../types';
import { uploadProductImage } from '../services/dataService';

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
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Image must be smaller than 10MB.'); return; }

    setIsUploading(true);
    setError('');
    try {
      // Use a temporary ID if creating a new product, or the real product ID if editing
      const tempId = product?.id || `temp-${Date.now()}`;
      const url = await uploadProductImage(file, tempId);
      setPhotoUrl(url);
    } catch (err: any) {
      setError(err.message || 'Upload failed. Make sure the "product-images" bucket exists in Supabase Storage.');
    } finally {
      setIsUploading(false);
    }
  };

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

          {/* Product Photo */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Product Photo</label>

            {/* Upload area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg py-5 cursor-pointer transition-all ${
                isUploading ? 'border-outreach/50 bg-outreach/5' : 'border-base-500 hover:border-outreach/40 hover:bg-base-700'
              }`}
            >
              {photoUrl ? (
                <div className="flex items-center gap-4">
                  <img
                    src={photoUrl}
                    alt="Product preview"
                    className="w-16 h-16 rounded-lg object-cover border border-base-600 flex-shrink-0"
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                  <div className="text-left">
                    <p className="text-xs text-text-secondary font-medium">Photo uploaded</p>
                    <p className="text-xs text-text-muted mt-0.5">Click to replace</p>
                  </div>
                </div>
              ) : isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 rounded-full border-2 border-t-outreach border-base-500 animate-spin" />
                  <p className="text-xs text-outreach-light">Uploading…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-text-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs font-medium">Click to upload photo</p>
                  <p className="text-xs">PNG, JPG, WebP up to 10MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Manual URL fallback */}
            <div className="mt-2">
              <input
                type="url"
                value={photoUrl}
                onChange={e => setPhotoUrl(e.target.value)}
                placeholder="Or paste image URL…"
                className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-1.5 text-xs text-text-secondary placeholder-text-muted focus:outline-none focus:border-outreach/50 transition-colors"
              />
            </div>
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
