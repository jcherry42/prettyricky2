import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Heart, Copy, Check, MessageSquare, Trash2, Sparkles, 
  Tag, Filter, ChevronDown, Folder
} from 'lucide-react';
import { useSales } from '../context/SalesContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Categories matching existing app patterns
const CATEGORIES = [
  { id: 'all', label: 'All', icon: '📋' },
  { id: 'price_negotiation', label: 'Price', icon: '💰' },
  { id: 'trade_in', label: 'Trade-In', icon: '🔄' },
  { id: 'objection_handling', label: 'Objections', icon: '🛡️' },
  { id: 'follow_up', label: 'Follow-Up', icon: '📞' },
  { id: 'competitor', label: 'Competitor', icon: '⚔️' },
  { id: 'financing', label: 'Financing', icon: '📊' },
  { id: 'features', label: 'Features', icon: '⚙️' },
  { id: 'closing', label: 'Closing', icon: '🎯' },
  { id: 'general', label: 'General', icon: '💬' },
];

export const FavoritesModal = () => {
  const {
    showFavorites,
    toggleFavorites,
    favorites,
    removeFavorite,
    copyToClipboard,
    shareToMessages,
    updateFavoriteCategory,
  } = useSales();
  
  const [copiedId, setCopiedId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [editingCategoryId, setEditingCategoryId] = useState(null);

  if (!showFavorites) return null;

  // Filter favorites by category
  const filteredFavorites = useMemo(() => {
    if (activeCategory === 'all') return favorites;
    return favorites.filter(f => f.category === activeCategory);
  }, [favorites, activeCategory]);

  // Count by category
  const categoryCounts = useMemo(() => {
    const counts = { all: favorites.length };
    favorites.forEach(f => {
      const cat = f.category || 'general';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [favorites]);

  const handleCopy = async (text, id) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSend = (text) => {
    shareToMessages(text);
  };

  const handleDelete = (id) => {
    removeFavorite(id);
  };

  const handleCategoryChange = (favoriteId, newCategory) => {
    if (updateFavoriteCategory) {
      updateFavoriteCategory(favoriteId, newCategory);
    }
    setEditingCategoryId(null);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getCategoryInfo = (categoryId) => {
    return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES.find(c => c.id === 'general');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center mclaren-glass-overlay">
      <div className="bottom-sheet glass-modal w-full max-w-lg max-h-[85vh] overflow-hidden animate-slide-up">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-border/50" />
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="mclaren-logo-badge w-10 h-10">
              <Heart className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Saved Responses</h2>
              <p className="text-xs text-muted-foreground">{favorites.length} favorite{favorites.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          
          <button
            onClick={() => toggleFavorites(false)}
            className="mclaren-btn-icon w-9 h-9"
            data-testid="close-favorites-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-5 py-3 border-b border-border/30 overflow-x-auto hide-scrollbar">
          <div className="flex gap-2">
            {CATEGORIES.filter(cat => cat.id === 'all' || categoryCounts[cat.id] > 0).map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`mclaren-tab text-xs whitespace-nowrap ${activeCategory === cat.id ? 'active' : ''}`}
                data-testid={`category-filter-${cat.id}`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                {categoryCounts[cat.id] > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/10 text-[10px]">
                    {categoryCounts[cat.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[55vh] hide-scrollbar">
          {filteredFavorites.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                {activeCategory === 'all' ? 'No saved responses yet' : `No ${getCategoryInfo(activeCategory)?.label} responses`}
              </h3>
              <p className="text-sm text-muted-foreground">
                {activeCategory === 'all' 
                  ? 'Generate a response with Tower Talk and tap the heart to save it here'
                  : 'Save responses in this category or check other filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFavorites.map((favorite) => {
                const categoryInfo = getCategoryInfo(favorite.category);
                
                return (
                  <div
                    key={favorite.id}
                    className="mclaren-card p-4 space-y-3 animate-fade-in"
                    data-testid={`favorite-item-${favorite.id}`}
                  >
                    {/* Context info & Category */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {/* Category Badge */}
                          {editingCategoryId === favorite.id ? (
                            <select
                              value={favorite.category || 'general'}
                              onChange={(e) => handleCategoryChange(favorite.id, e.target.value)}
                              onBlur={() => setEditingCategoryId(null)}
                              autoFocus
                              className="text-xs px-2 py-1 bg-muted/50 border border-border/50 rounded-lg focus:outline-none focus:border-primary/50"
                            >
                              {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.icon} {cat.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingCategoryId(favorite.id)}
                              className="flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                              title="Click to change category"
                            >
                              <span>{categoryInfo?.icon}</span>
                              <span>{categoryInfo?.label}</span>
                              <ChevronDown className="w-3 h-3 opacity-50" />
                            </button>
                          )}
                        </div>
                        
                        {favorite.customerName && (
                          <p className="text-xs text-muted-foreground truncate">
                            For <span className="text-primary font-medium">{favorite.customerName}</span>
                            {favorite.vehicle && (
                              <> • {favorite.vehicle}</>
                            )}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                          {formatDate(favorite.savedAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(favorite.id)}
                        className="mclaren-btn-icon w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        data-testid={`delete-favorite-${favorite.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Situation snippet */}
                    {favorite.situation && (
                      <p className="text-xs text-muted-foreground bg-muted/20 px-3 py-2 rounded-lg line-clamp-2">
                        "{favorite.situation}"
                      </p>
                    )}
                    
                    {/* Response text */}
                    <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl">
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {favorite.response}
                      </p>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopy(favorite.response, favorite.id)}
                        className={`mclaren-btn-ghost flex-1 text-xs gap-1.5 font-medium py-2 ${
                          copiedId === favorite.id ? 'text-emerald-400 border-emerald-500/30' : ''
                        }`}
                        data-testid={`copy-favorite-${favorite.id}`}
                      >
                        {copiedId === favorite.id ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => handleSend(favorite.response)}
                        className="mclaren-btn-primary flex-1 text-xs gap-1.5 py-2"
                        data-testid={`send-favorite-${favorite.id}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        iMessage
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FavoritesModal;
