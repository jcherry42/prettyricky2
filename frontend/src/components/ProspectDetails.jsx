import React from 'react';
import { Phone, Mail, Car, Calendar, FileText, DollarSign, Repeat } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useSales } from '../context/SalesContext';

const statusConfig = {
  hot: { label: 'Hot Lead', variant: 'hot', description: 'Ready to close' },
  warm: { label: 'Warm Lead', variant: 'warm', description: 'Actively engaged' },
  cold: { label: 'Cold Lead', variant: 'cold', description: 'Needs nurturing' },
  sold: { label: 'Sold', variant: 'sold', description: 'Deal closed' },
};

export const ProspectDetails = () => {
  const { selectedProspect, getVehicleById, objectionTypes } = useSales();

  if (!selectedProspect) {
    return (
      <div className="glass-card rounded-xl p-6">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Car className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">
            No Prospect Selected
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Select a prospect from the dropdown above to see their details and get tailored responses.
          </p>
        </div>
      </div>
    );
  }

  const vehicle = getVehicleById(selectedProspect.vehicle);
  const status = statusConfig[selectedProspect.status] || statusConfig.cold;
  const prospectObjections = objectionTypes.filter(o => selectedProspect.objections.includes(o.id));

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Header with status */}
      <div className="px-5 py-4 border-b border-border/50 bg-gradient-to-r from-transparent via-primary/5 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              {selectedProspect.name}
            </h3>
            <p className="text-sm text-muted-foreground">{status.description}</p>
          </div>
          <Badge variant={status.variant} className="text-xs">
            {status.label}
          </Badge>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Contact info */}
        <div className="flex flex-wrap gap-3">
          <a 
            href={`tel:${selectedProspect.phone}`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
          >
            <Phone className="w-4 h-4 text-primary" />
            <span className="text-foreground">{selectedProspect.phone}</span>
          </a>
          <a 
            href={`mailto:${selectedProspect.email}`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
          >
            <Mail className="w-4 h-4 text-primary" />
            <span className="text-foreground truncate max-w-[180px]">{selectedProspect.email}</span>
          </a>
        </div>

        {/* Vehicle Interest */}
        {vehicle && (
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Car className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Interested In</p>
                <p className="font-medium text-foreground">
                  {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}
                </p>
                <p className="text-lg font-display font-semibold text-primary mt-1">
                  ${vehicle.price.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Trade-in */}
        {selectedProspect.tradeVehicle && (
          <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Repeat className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Trade-In</p>
                <p className="font-medium text-foreground">
                  {selectedProspect.tradeVehicle.year} {selectedProspect.tradeVehicle.make} {selectedProspect.tradeVehicle.model}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Est. Value: <span className="text-foreground font-medium">${selectedProspect.tradeVehicle.value.toLocaleString()}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Known Objections */}
        {prospectObjections.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Known Objections</p>
            <div className="flex flex-wrap gap-2">
              {prospectObjections.map((objection) => (
                <Badge key={objection.id} variant="accent" className="text-xs">
                  {objection.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {selectedProspect.notes && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Notes</p>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <p className="text-sm text-foreground leading-relaxed">
                {selectedProspect.notes}
              </p>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>Last contact: {selectedProspect.lastContact}</span>
          </div>
          {selectedProspect.nextFollowUp && (
            <Badge variant="soft" className="text-xs">
              Follow-up: {selectedProspect.nextFollowUp}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProspectDetails;
