import React from 'react'
import Step1 from './page'

describe('<Step1 />', () => {
  it('renders', () => {
    // see: https://on.cypress.io/mounting-react
    cy.mount(<Step1 />)
  })
})