import { useState, useEffect } from 'preact/hooks'
import { X } from 'lucide-preact'

// External dependencies (these would need to be provided)
declare const submitContactForm: any

// Simple cookie utility
function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(
    value,
  )}; expires=${expires}; path=/`
}
function getCookie(name: string) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=')
    return parts[0] === name ? decodeURIComponent(parts[1]) : r
  }, '')
}

// Configuration interface
interface ChatWidgetConfig {
  avatarUrl?: string
}

declare global {
  interface Window {
    chatWidgetConfig?: ChatWidgetConfig
  }
}

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false)
  const openChat = () => setIsOpen(true)
  const closeChat = () => setIsOpen(false)
  const [showBubble, setShowBubble] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    location: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get avatar URL from config or default
  const defaultAvatar =
    'https://images.leadconnectorhq.com/image/f_webp/q_100/r_180/u_https://assets.cdn.filesafe.space/wJVrTbSAivxHv8BabSZZ/media/683734474eb4a1521d0c2f72.png'
  const avatarUrl = window.chatWidgetConfig?.avatarUrl || defaultAvatar

  // On mount, check for dismissal cookie
  useEffect(() => {
    if (getCookie('chatDismissed') === 'true') {
      setShowBubble(false)
      setDismissed(true)
    } else {
      setShowBubble(true)
    }
  }, [])

  // Handler for dismissing the bubble
  const handleDismissBubble = () => {
    setShowBubble(false)
    setDismissed(true)
    setCookie('chatDismissed', 'true')
  }

  // Handler for closing the chat window
  const handleCloseChat = () => {
    closeChat()
    setDismissed(true)
    setCookie('chatDismissed', 'true')
  }

  // Handler for form input changes
  const handleInputChange = (e: any) => {
    const target = e.target as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
    const { name, value } = target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Handler for form submission
  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!formData.firstName.trim()) {
      alert('Please enter your first name')
      return
    }
    if (!formData.phone.trim()) {
      alert('Please enter your phone number')
      return
    }
    if (!formData.location) {
      alert('Please select a location')
      return
    }

    setIsSubmitting(true)
    try {
      // const posthogID = posthog.get_distinct_id()
      const result = await submitContactForm({
        ...formData,
        // posthogID,
        formType: 'chat-form',
      })

      if (result.success) {
        alert('Thank you for your message! We will get back to you soon.')
        setFormData({
          firstName: '',
          lastName: '',
          phone: '',
          location: '',
          message: '',
        })
        handleCloseChat()
      } else {
        throw new Error(result.error || 'Failed to submit form')
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      alert('There was an error submitting your message. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Only allow chat window to open if user clicks the button
  const handleToggleChat = () => {
    if (!isOpen) {
      openChat()
    } else {
      handleCloseChat()
    }
  }

  return (
    <>
      {/* Chat Bubble */}
      {showBubble && !isOpen && !dismissed && (
        <div className="fixed bottom-21 right-4 bg-white rounded-2xl shadow-lg p-4 pr-5 pl-3 flex items-center z-[1001] max-w-80">
          <img
            src={avatarUrl}
            alt="Gianna"
            className="w-10 h-10 rounded-full mr-3"
          />
          <span className="text-sm  text-gray-800 font-normal inline-block mr-4">
            I'm Gianna, what can I help you with?
          </span>
          <button
            aria-label="Dismiss"
            onClick={handleDismissBubble}
            className="bg-transparent border-none ml-3 cursor-pointer text-xl text-gray-500 absolute right-0 top-0"
          >
            ×
          </button>
          <div className="h-6 w-6 rounded-xs absolute -bottom-1 z-20 bg-white rotate-45 right-4" />
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-19 right-10 w-75 h-[410px] rounded-2xl shadow-2xl z-[1002] flex flex-col overflow-hidden bg-black">
          <div className="bg-white flex gap-2 p-2 text-sm text-black">
            <img
              src={avatarUrl}
              alt="Front desk avatar"
              className="w-10 h-10 rounded-full mr-3"
            />
            <span className="text-sm">
              Request an appointment or submit your question below.{' '}
            </span>

            <button
              className="bg-white text-black w-4 h-4 flex items-center justify-center rounded-md"
              onClick={handleCloseChat}
            >
              <X size={16} />
            </button>
          </div>
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-black flex-1 overflow-y-auto text-sm"
          >
            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  required
                  placeholder="First Name *"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1.5 text-sm border border-gray-600 bg-gray-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-[#b99272] focus:border-transparent placeholder:text-gray-400"
                />
              </div>

              <div>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1.5 text-sm border border-gray-600 bg-gray-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-[#b99272] focus:border-transparent placeholder:text-gray-400"
                />
              </div>

              <div>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  required
                  placeholder="Phone *"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1.5 text-sm border border-gray-600 bg-gray-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-[#b99272] focus:border-transparent placeholder:text-gray-400"
                />
              </div>

              <div>
                <select
                  id="location"
                  name="location"
                  required
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1.5 text-sm border border-gray-600 bg-gray-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-[#b99272] focus:border-transparent"
                >
                  <option value="">Select Location *</option>
                  <option value="Belmar">Belmar</option>
                  <option value="Freehold">Freehold</option>
                </select>
              </div>

              <div>
                <textarea
                  id="message"
                  name="message"
                  rows={3}
                  placeholder="Message"
                  value={formData.message}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1.5 text-sm border border-gray-600 bg-gray-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-[#b99272] focus:border-transparent resize-none placeholder:text-gray-400"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#b99272] text-white py-1.5 px-3 text-sm rounded hover:bg-[#c9a77e] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Chat Button */}
      <button
        aria-label="Open chat"
        onClick={handleToggleChat}
        className="fixed bottom-5 right-5 w-14 h-14 rounded-full bg-[#b99272] border-none shadow-lg flex items-center justify-center cursor-pointer transition-colors p-0 z-[1003] hover:bg-[#c9a77e]"
      >
        <div className="w-6 h-6 flex items-center justify-center">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white"
          >
            <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
          </svg>
        </div>
      </button>
    </>
  )
}
