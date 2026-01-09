import React, { useState } from 'react';
import { X, Heart, Copy, Check, MessageSquare, Trash2, Sparkles } from 'lucide-react';
import { useSales } from '../context/SalesContext';

export const FavoritesModal = () => {
  const {
    showFavorites,
    toggleFavorites,
    favorites,
    removeFavorite,
    copyToClipboard,
    shareToMessages,
  } = useSales();
  
  const [copiedId, setCopiedId] = useState(null);

  if (!showFavorites) return null;

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

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="bottom-sheet w-full max-w-lg max-h-[85vh] overflow-hidden animate-slide-up">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Saved Responses</h2>
              <p className="text-xs text-muted-foreground">{favorites.length} favorite{favorites.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          
          <button
            onClick={() => toggleFavorites(false)}
            className="ios-btn w-9 h-9 bg-muted/50 rounded-full text-muted-foreground hover:text-foreground"
            data-testid="close-favorites-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh] hide-scrollbar">
          {favorites.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">No saved responses yet</h3>
              <p className="text-sm text-muted-foreground">
                Generate a response with Tower Talk and tap the heart to save it here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {favorites.map((favorite) => (
                <div
                  key={favorite.id}
                  className="glass-card p-4 space-y-3 animate-fade-in"
                  data-testid={`favorite-item-${favorite.id}`}
                >
                  {/* Context info */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
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
                      className="ios-btn w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                      data-testid={`delete-favorite-${favorite.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Situation snippet */}
                  {favorite.situation && (
                    <p className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg line-clamp-2">
                      "{favorite.situation}"
                    </p>
                  )}
                  
                  {/* Response text */}
                  <div className="p-4 bg-gradient-to-br from-tower/10 to-tower/5 border border-tower/20 rounded-xl">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {favorite.response}
                    </p>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopy(favorite.response, favorite.id)}
                      className={`
                        ios-btn flex-1 text-xs gap-1.5 font-medium py-2
                        ${copiedId === favorite.id 
                          ? 'ios-btn-success' 
                          : 'ios-btn-secondary'
                        }
                      `}
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
                      className="ios-btn-primary flex-1 text-xs gap-1.5 py-2"
                      data-testid={`send-favorite-${favorite.id}`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      iMessage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FavoritesModal;
