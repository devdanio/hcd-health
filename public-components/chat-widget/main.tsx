import { render } from 'preact'
import { ChatWidget } from './ChatWidget'
import './index.css'

// Create a container for the widget
const containerId = 'leadalytics-chat-widget'
let container = document.getElementById(containerId)

if (!container) {
  container = document.createElement('div')
  container.id = containerId
  document.body.appendChild(container)
}

render(<ChatWidget />, container)
