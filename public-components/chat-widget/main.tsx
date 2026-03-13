import { render } from 'preact'
import { ChatWidget } from './ChatWidget'
import styles from './index.css?inline'

// Create a container for the widget
const containerId = 'hch-chat-widget'
let container = document.getElementById(containerId)

if (!container) {
  container = document.createElement('div')
  container.id = containerId
  // Ensure the container sits above everything else
  container.style.position = 'fixed'
  container.style.zIndex = '99999'
  container.style.bottom = '0'
  container.style.right = '0'
  // Reset styles for the container to avoid inheritance issues
  container.style.lineHeight = '1.5'
  container.style.textAlign = 'left'
  container.style.color = 'black'
  
  document.body.appendChild(container)
}

// Create shadow root for style isolation
let shadow = container.shadowRoot
if (!shadow) {
  shadow = container.attachShadow({ mode: 'open' })
}

// Render with styles inside shadow DOM
render(
  <>
    <style>{styles}</style>
    <ChatWidget />
  </>,
  shadow
)
