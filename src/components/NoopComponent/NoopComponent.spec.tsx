import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom'; 
import NoopComponent from './NoopComponent';

describe('NoopComponent', () => {
  test('renders Hello MicroFrontend text', () => {
    render(<NoopComponent />);
    expect(screen.getByText('Hello MicroFrontend')).toBeInTheDocument();
  });
});
