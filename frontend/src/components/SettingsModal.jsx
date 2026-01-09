import React, { useState } from 'react';
import { Settings, User, Building2, Save, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useSales } from '../context/SalesContext';

export const SettingsModal = ({ open, onOpenChange }) => {
  const { settings, updateSettings } = useSales();
  const [formData, setFormData] = useState(settings);
  const [saved, setSaved] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    updateSettings(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClose = () => {
    setFormData(settings);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Customize your Closr experience. Changes are saved locally.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Dealership Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Building2 className="w-4 h-4 text-primary" />
              Dealership Information
            </div>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="dealershipName">Dealership Name</Label>
                <Input
                  id="dealershipName"
                  value={formData.dealershipName}
                  onChange={(e) => handleChange('dealershipName', e.target.value)}
                  placeholder="Your Dealership Name"
                />
              </div>
            </div>
          </div>

          {/* Rep Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <User className="w-4 h-4 text-primary" />
              Sales Rep Information
            </div>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="repName">Your Name</Label>
                <Input
                  id="repName"
                  value={formData.repName}
                  onChange={(e) => handleChange('repName', e.target.value)}
                  placeholder="Your Name"
                />
              </div>
            </div>
          </div>

          {/* Default Finance Terms */}
          <div className="space-y-4">
            <div className="text-sm font-medium text-foreground">
              Default Finance Terms
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defaultTerm">Loan Term (months)</Label>
                <Input
                  id="defaultTerm"
                  type="number"
                  value={formData.defaultTerm}
                  onChange={(e) => handleChange('defaultTerm', parseInt(e.target.value) || 60)}
                  min={12}
                  max={84}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="defaultDownPayment">Down Payment (%)</Label>
                <Input
                  id="defaultDownPayment"
                  type="number"
                  value={formData.defaultDownPayment}
                  onChange={(e) => handleChange('defaultDownPayment', parseInt(e.target.value) || 10)}
                  min={0}
                  max={50}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border/50">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            variant={saved ? "success" : "glossy"} 
            onClick={handleSave}
            className="min-w-[100px]"
          >
            {saved ? (
              <>
                <Save className="w-4 h-4" />
                Saved!
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
