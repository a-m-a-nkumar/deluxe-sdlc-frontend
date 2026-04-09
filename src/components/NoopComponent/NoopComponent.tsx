import React from 'react';

export type NoopComponentProps = {
  // Add any props you need here
}

const NoopComponent: React.FC<NoopComponentProps> = () => {
  return (
    <div>
      Hello MicroFrontend
    </div>
  );
};

export default NoopComponent;
