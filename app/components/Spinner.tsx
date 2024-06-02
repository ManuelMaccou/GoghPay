import React from 'react';
import '../globals.css'

export default function Spinner() {
  return (
    <div 
      className="spinner"
      aria-busy="true"
      aria-live="assertive"
      role="alert"
      aria-label="Loading content, please wait."
    ></div>
  );
}