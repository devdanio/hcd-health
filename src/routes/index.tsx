import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Heart, Clock, Smartphone } from 'lucide-react'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">L</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">Leadalytics</span>
          </div>
          <button className="text-gray-700 hover:text-gray-900 underline">
            Contact us
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              {/* Doctor Avatars */}
              <div className="flex items-center gap-2 mb-6">
                <span className="text-gray-600">(</span>
                <div className="flex -space-x-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-white" />
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 border-2 border-white" />
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-white" />
                </div>
                <span className="text-gray-600">)</span>
              </div>

              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                A Leap In Healthcare
                <br />
                Data Analytics
              </h1>

              <p className="text-lg text-gray-600 mb-8 max-w-lg">
                Telehealth solutions thoughtfully designed to streamline your virtual care delivery.
              </p>

              <div className="flex flex-wrap gap-4 mb-12">
                <Button className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-6 rounded-full text-lg">
                  Get Started →
                </Button>
                <Button variant="outline" className="border-2 border-gray-900 text-gray-900 px-8 py-6 rounded-full text-lg bg-lime-200 hover:bg-lime-300">
                  Book scoping call
                </Button>
              </div>

              {/* Stats Badge */}
              <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4 inline-flex">
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-white" />
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 border-2 border-white" />
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-white" />
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-100 to-pink-200 border-2 border-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">50+</div>
                  <div className="text-sm text-gray-600">Medical specialties</div>
                </div>
              </div>
            </div>

            {/* Right Content - Hero Image */}
            <div className="relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src="/Users/dan/.gemini/antigravity/brain/0607b265-82b2-4118-82e8-5fd1f3490020/hero_customer_service_1764781457469.png"
                  alt="Healthcare professional"
                  className="w-full h-auto"
                />
                
                {/* Floating Tags */}
                <div className="absolute top-6 left-6 bg-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
                  <div className="w-2 h-2 bg-lime-400 rounded-full" />
                  <span className="text-sm font-medium">Convenient</span>
                  <button className="text-gray-400 hover:text-gray-600">+</button>
                </div>
                
                <div className="absolute top-16 left-6 bg-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
                  <div className="w-2 h-2 bg-lime-400 rounded-full" />
                  <span className="text-sm font-medium">Accessible</span>
                  <button className="text-gray-400 hover:text-gray-600">+</button>
                </div>
                
                <div className="absolute top-26 left-6 bg-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-300 rounded-full" />
                  <span className="text-sm font-medium text-gray-400">Affordable</span>
                  <button className="text-gray-400 hover:text-gray-600">+</button>
                </div>

                {/* Floating Info Cards */}
                <div className="absolute bottom-6 right-6 bg-white rounded-2xl p-4 shadow-xl max-w-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200" />
                    <div>
                      <div className="font-semibold text-gray-900">24/7 Support For</div>
                      <div className="font-semibold text-gray-900">Clinicians</div>
                      <div className="text-xs text-gray-500 mt-1">Service #1</div>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-24 right-6 bg-teal-500 rounded-full p-3 shadow-xl">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div className="absolute bottom-24 right-20 bg-white rounded-2xl px-4 py-2 shadow-xl">
                  <span className="text-sm font-medium">Flexibility & Convenience</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-4">
            <span className="inline-block bg-lime-200 text-gray-900 px-4 py-1 rounded-full text-sm font-medium mb-6">
              For Providers
            </span>
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-bold text-center text-gray-900 mb-4">
            Efficiently Manage and
          </h2>
          <div className="flex items-center justify-center gap-3 mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">Grow</h2>
            <div className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center">
              <Check className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">Your Practice</h2>
          </div>

          {/* Doctor Avatars Row */}
          <div className="flex justify-center -space-x-4 mb-16">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border-4 border-white shadow-lg" />
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 border-4 border-white shadow-lg" />
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 border-4 border-white shadow-lg" />
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-100 to-pink-200 border-4 border-white shadow-lg" />
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-100 to-yellow-200 border-4 border-white shadow-lg" />
          </div>

          {/* Feature Cards */}
          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            <div className="bg-gray-50 rounded-3xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Join Us And Take Your Medical Practice To New Heights.
              </h3>
              <p className="text-gray-600">
                With our user-friendly application, you can efficiently serve a larger number of patients while increasing your earnings.
              </p>
            </div>

            <div className="bg-gray-100 rounded-3xl overflow-hidden">
              <img
                src="/Users/dan/.gemini/antigravity/brain/0607b265-82b2-4118-82e8-5fd1f3490020/doctors_collaborating_1764781472684.png"
                alt="Doctors collaborating"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="bg-gray-50 rounded-3xl p-8 flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Care For More Patients From Home
                </h3>
                <p className="text-gray-600 mb-6">
                  Our platform offers doctors the opportunity to expand their practice like never before.
                </p>
              </div>
              <div className="flex justify-end -space-x-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-white" />
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 border-2 border-white" />
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-white" />
                <button className="w-12 h-12 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50">
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-5xl font-bold text-gray-900 mb-2">5+</div>
              <div className="text-gray-600">Million Patient Visits</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-gray-900 mb-2">20%</div>
              <div className="text-gray-600">Increase in Earnings</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-gray-900 mb-2">9k+</div>
              <div className="text-gray-600">Registered Doctors</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-gray-900 mb-2">24/7</div>
              <div className="text-gray-600">Accessibility</div>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist Form Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-lime-200 rounded-lg flex items-center justify-center">
              <span className="text-xl">✉️</span>
            </div>
            <span className="text-gray-700">hi@leadalytics.com</span>
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-12">
            Be the first to access our app: join the waiting list today
          </h2>

          <div className="bg-white rounded-3xl p-8 shadow-lg">
            <form className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <Input
                    placeholder="Emily"
                    className="w-full border-b border-gray-300 rounded-none border-t-0 border-l-0 border-r-0 px-0 focus:ring-0 focus:border-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <Input
                    placeholder="Johnson"
                    className="w-full border-b border-gray-300 rounded-none border-t-0 border-l-0 border-r-0 px-0 focus:ring-0 focus:border-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Email
                </label>
                <Input
                  type="email"
                  placeholder="emily.johnson@email.com"
                  className="w-full border-b border-gray-300 rounded-none border-t-0 border-l-0 border-r-0 px-0 focus:ring-0 focus:border-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <Input
                  type="tel"
                  placeholder="Phone"
                  className="w-full border-b border-gray-300 rounded-none border-t-0 border-l-0 border-r-0 px-0 focus:ring-0 focus:border-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specialization
                </label>
                <Input
                  placeholder="Dentist"
                  className="w-full border-b border-gray-300 rounded-none border-t-0 border-l-0 border-r-0 px-0 focus:ring-0 focus:border-gray-900"
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-6 rounded-full text-lg">
                  Join Waiting List →
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Patient Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-4">
            <span className="inline-block bg-lime-200 text-gray-900 px-4 py-1 rounded-full text-sm font-medium mb-6">
              For Patients
            </span>
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold text-center text-gray-900 mb-16">
            Get Expert Consultations
            <br />
            Anytime, <span className="inline-flex items-center gap-2"><Clock className="w-10 h-10" /> Anywhere.</span>
          </h2>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Mobile App Mockup */}
            <div className="bg-gray-100 rounded-3xl p-8">
              <div className="bg-white rounded-3xl p-6 shadow-xl max-w-sm mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-white" />
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 border-2 border-white" />
                  </div>
                  <div className="w-8 h-8 bg-teal-500 rounded-lg" />
                  <button className="text-gray-400">🔍</button>
                </div>

                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-200 to-blue-300" />
                      <div>
                        <div className="font-semibold text-gray-900">Dr. Sarah Chen</div>
                        <div className="text-xs text-gray-600">Cardiologist</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-200 to-teal-300" />
                      <div>
                        <div className="font-semibold text-gray-900">Dr. Michael Ross</div>
                        <div className="text-xs text-gray-600">Pediatrician</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-200 to-purple-300" />
                      <div>
                        <div className="font-semibold text-gray-900">Dr. Lisa Park</div>
                        <div className="text-xs text-gray-600">Dermatologist</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <div className="text-sm font-medium text-gray-700">Your recent doctors</div>
                  <div className="flex justify-center -space-x-2 mt-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-white" />
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 border-2 border-white" />
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-white" />
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-100 to-pink-200 border-2 border-white" />
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center">
                <p className="text-gray-700 font-medium">Say goodbye to long waits at the doctor's office.</p>
              </div>
            </div>

            {/* Patient Image and Features */}
            <div>
              <div className="bg-gray-100 rounded-3xl overflow-hidden mb-8">
                <img
                  src="/Users/dan/.gemini/antigravity/brain/0607b265-82b2-4118-82e8-5fd1f3490020/patient_laptop_1764781498345.png"
                  alt="Patient using laptop"
                  className="w-full h-auto"
                />
                <div className="p-6 bg-white">
                  <p className="text-gray-700">
                    With our app, you can get expert medical advice right at your fingertips.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Smartphone className="w-8 h-8 text-teal-600" />
                  </div>
                  <div className="font-semibold text-gray-900">Instant</div>
                  <div className="font-semibold text-gray-900">Consultations</div>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Heart className="w-8 h-8 text-teal-600" />
                  </div>
                  <div className="font-semibold text-gray-900">Health</div>
                  <div className="font-semibold text-gray-900">Journey</div>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Check className="w-8 h-8 text-teal-600" />
                  </div>
                  <div className="font-semibold text-gray-900">Verified</div>
                  <div className="font-semibold text-gray-900">Doctors</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">L</span>
            </div>
            <span className="text-xl font-semibold">Leadalytics</span>
          </div>
          <p className="text-gray-400">
            Modern data solutions for your healthcare practice
          </p>
        </div>
      </footer>
    </div>
  )
}
