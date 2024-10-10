import React from 'react'
import SquarePaymentButton from './SquarePaymentButton'

describe('<SquarePaymentButton />', () => {
  it('renders', () => {
    // see: https://on.cypress.io/mounting-react
    cy.mount(<SquarePaymentButton />)
  })
})