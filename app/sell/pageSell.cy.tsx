import React from 'react'
import Sell from './page'

describe('<Sell />', () => {
  it('renders', () => {
    // see: https://on.cypress.io/mounting-react
    cy.mount(<Sell />)
  })
})