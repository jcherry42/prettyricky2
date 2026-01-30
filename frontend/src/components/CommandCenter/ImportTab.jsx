import React, { memo } from 'react';
import { Upload, Edit3, Camera } from 'lucide-react';

const ImportOption = memo(({ icon: Icon, title, color, onClick }) => (
  <div className={`import-option ${color}`} onClick={onClick}>
    <div className="io-icon"><Icon className="w-10 h-10" strokeWidth={1.5} /></div>
    <span className="io-title">{title}</span>
  </div>
));

ImportOption.displayName = 'ImportOption';

const ImportTab = memo(({ onFileUpload, onManualEntry, onVisionExtract }) => {
  return (
    <div className="import-tab">
      <div className="import-options">
        <ImportOption
          icon={Upload}
          title="File Upload"
          color="cyan"
          onClick={onFileUpload}
        />
        <ImportOption
          icon={Edit3}
          title="Manual Entry"
          color="green"
          onClick={onManualEntry}
        />
        <ImportOption
          icon={Camera}
          title="Vision Extraction"
          color="purple"
          onClick={onVisionExtract}
        />
      </div>
      
      <div className="import-integrations">
        <h4>Integrations</h4>
        <IntegrationItem name="DealerSocket" connected={false} />
        <IntegrationItem name="VinSolutions" connected={false} />
        <IntegrationItem name="CDK Global" connected={false} />
      </div>
    </div>
  );
});

const IntegrationItem = memo(({ name, connected }) => (
  <div className="integration-item">
    <span className="int-name">{name}</span>
    <button className={`int-btn ${connected ? 'connected' : 'connect'}`}>
      {connected ? 'Connected' : 'Connect'}
    </button>
  </div>
));

IntegrationItem.displayName = 'IntegrationItem';
ImportTab.displayName = 'ImportTab';

export default ImportTab;
