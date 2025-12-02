import Image from 'next/image';

export function DemoGuide() {
  return (
    <section id="demo" className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold text-faxi-brown mb-8">
          Using the Interactive Demo
        </h2>

        {/* Overview */}
        <div className="mb-12">
          <p className="text-lg text-gray-700 mb-4">
            The Faxi Interactive Demo allows you to experience how our AI-powered system transforms 
            handwritten faxes into digital actions. You can try sample faxes, create your own custom 
            fax, or upload an existing fax image.
          </p>
          
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-6">
            <p className="font-semibold text-blue-900 mb-2">💡 First Time Here?</p>
            <p className="text-blue-800">
              We recommend starting with <strong>Sample Faxes</strong> to see how Faxi works with 
              pre-made examples before creating your own.
            </p>
          </div>

          {/* Demo Homepage Screenshot */}
          <div className="my-8 rounded-lg overflow-hidden border border-gray-200 shadow-lg">
            <Image
              src="/screenshots/demo-homepage.png"
              alt="Demo Homepage"
              width={1920}
              height={1080}
              className="w-full h-auto"
              priority
            />
            <p className="text-sm text-gray-600 text-center py-2 bg-gray-50">
              The Interactive Demo homepage
            </p>
          </div>
        </div>

        {/* Three Ways to Try Faxi */}
        <div className="mb-12">
          <h3 className="text-3xl font-bold text-faxi-brown mb-6">
            Three Ways to Try Faxi
          </h3>

          {/* 1. Sample Faxes */}
          <div className="mb-10">
            <h4 className="text-2xl font-semibold text-gray-900 mb-4">
              1. Sample Faxes (Recommended)
            </h4>
            <p className="text-gray-700 mb-4">
              The easiest way to experience Faxi is with our pre-made sample faxes that demonstrate 
              different use cases.
            </p>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h5 className="font-semibold text-gray-900 mb-3">How to Use:</h5>
              <ol className="space-y-2 text-gray-700">
                <li>1. Click the <strong>&quot;Sample Faxes&quot;</strong> button (selected by default)</li>
                <li>2. Browse the gallery of sample scenarios</li>
                <li>3. Click on any sample to preview it</li>
                <li>4. Click <strong>&quot;Process Selected Fax&quot;</strong> to see how Faxi interprets it</li>
                <li>5. View the results showing detected intent and extracted information</li>
              </ol>
            </div>

            {/* Sample Faxes Gallery Screenshot */}
            <div className="my-6 rounded-lg overflow-hidden border border-gray-200 shadow-lg">
              <Image
                src="/screenshots/sample-faxes-gallery.png"
                alt="Sample Faxes Gallery"
                width={1920}
                height={1080}
                className="w-full h-auto"
              />
              <p className="text-sm text-gray-600 text-center py-2 bg-gray-50">
                Browse through various sample fax scenarios
              </p>
            </div>

            <div className="bg-green-50 border-l-4 border-green-500 p-4 my-6">
              <p className="font-semibold text-green-900 mb-2">✨ Try These First:</p>
              <ul className="text-green-800 space-y-1">
                <li>• <strong>Email Request</strong> - See email composition from handwriting</li>
                <li>• <strong>Shopping Request</strong> - Watch product search in action</li>
                <li>• <strong>Product Selection with Checkmarks</strong> - See visual annotation detection</li>
              </ul>
            </div>
          </div>

          {/* 2. Create Your Own */}
          <div className="mb-10">
            <h4 className="text-2xl font-semibold text-gray-900 mb-4">
              2. Create Your Own Fax
            </h4>
            <p className="text-gray-700 mb-4">
              Test Faxi with your own handwritten text using the drawing canvas.
            </p>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h5 className="font-semibold text-gray-900 mb-3">How to Use:</h5>
              <ol className="space-y-2 text-gray-700">
                <li>1. Click the <strong>&quot;Create Your Own&quot;</strong> button</li>
                <li>2. Use the drawing canvas with your mouse, trackpad, or touch screen</li>
                <li>3. Write your request naturally as you would on paper</li>
                <li>4. Click <strong>&quot;Process Fax&quot;</strong> when done</li>
              </ol>
            </div>

            {/* Create Your Own Screenshot */}
            <div className="my-6 rounded-lg overflow-hidden border border-gray-200 shadow-lg">
              <Image
                src="/screenshots/create-your-own-mode.png"
                alt="Create Your Own Mode"
                width={1920}
                height={1080}
                className="w-full h-auto"
              />
              <p className="text-sm text-gray-600 text-center py-2 bg-gray-50">
                Drawing canvas for creating custom faxes
              </p>
            </div>

            {/* Custom Fax Canvas Screenshot */}
            <div className="my-6 rounded-lg overflow-hidden border border-gray-200 shadow-lg">
              <Image
                src="/screenshots/custom-fax-canvas.png"
                alt="Custom Fax Canvas with Drawing"
                width={1920}
                height={1080}
                className="w-full h-auto"
              />
              <p className="text-sm text-gray-600 text-center py-2 bg-gray-50">
                Example of handwritten text on the canvas
              </p>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 my-6">
              <p className="font-semibold text-yellow-900 mb-2">💡 Tips for Best Results:</p>
              <ul className="text-yellow-800 space-y-1">
                <li>• Write clearly and legibly</li>
                <li>• Use simple, direct language</li>
                <li>• Include specific details (email addresses, product names)</li>
                <li>• Try adding visual marks like checkboxes or circles</li>
              </ul>
            </div>
          </div>

          {/* 3. Upload File */}
          <div className="mb-10">
            <h4 className="text-2xl font-semibold text-gray-900 mb-4">
              3. Upload a File
            </h4>
            <p className="text-gray-700 mb-4">
              Have an existing fax image? Upload it to see how Faxi processes it.
            </p>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h5 className="font-semibold text-gray-900 mb-3">How to Use:</h5>
              <ol className="space-y-2 text-gray-700">
                <li>1. Click the <strong>&quot;Upload File&quot;</strong> button</li>
                <li>2. Click the upload area or drag and drop your file</li>
                <li>3. Supported formats: PNG, JPG, JPEG, PDF (max 10MB)</li>
                <li>4. Wait for upload and processing</li>
                <li>5. View the results</li>
              </ol>
            </div>

            {/* Upload File Screenshot */}
            <div className="my-6 rounded-lg overflow-hidden border border-gray-200 shadow-lg">
              <Image
                src="/screenshots/upload-file-mode.png"
                alt="Upload File Mode"
                width={1920}
                height={1080}
                className="w-full h-auto"
              />
              <p className="text-sm text-gray-600 text-center py-2 bg-gray-50">
                File upload interface
              </p>
            </div>

            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 my-6">
              <p className="font-semibold text-purple-900 mb-2">📋 Best Practices:</p>
              <ul className="text-purple-800 space-y-1">
                <li>• Use clear, high-resolution images</li>
                <li>• Ensure text is readable</li>
                <li>• Avoid excessive shadows or glare</li>
                <li>• Keep content within the frame</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Understanding Results */}
        <div className="mb-12">
          <h3 className="text-3xl font-bold text-faxi-brown mb-6">
            Understanding the Results
          </h3>
          <p className="text-gray-700 mb-6">
            After processing any fax, you&apos;ll see a detailed breakdown of how Faxi interpreted your fax.
          </p>

          <div className="space-y-6">
            <div className="border-l-4 border-blue-500 pl-6 py-2">
              <h4 className="font-semibold text-lg text-gray-900 mb-2">1. Intent Detection</h4>
              <p className="text-gray-700 mb-2">What Faxi thinks you want to do:</p>
              <ul className="text-gray-700 space-y-1">
                <li>📧 <strong>Email</strong> - Send or manage emails</li>
                <li>🛒 <strong>Shopping</strong> - Browse or order products</li>
                <li>💬 <strong>AI Chat</strong> - Ask questions</li>
                <li>💳 <strong>Payment</strong> - Manage payment methods</li>
                <li>📅 <strong>Appointment</strong> - Schedule appointments</li>
              </ul>
            </div>

            <div className="border-l-4 border-green-500 pl-6 py-2">
              <h4 className="font-semibold text-lg text-gray-900 mb-2">2. Extracted Information</h4>
              <p className="text-gray-700">
                Key details found in your fax: email addresses, product names, questions, payment details, dates, and preferences.
              </p>
            </div>

            <div className="border-l-4 border-yellow-500 pl-6 py-2">
              <h4 className="font-semibold text-lg text-gray-900 mb-2">3. Confidence Score</h4>
              <p className="text-gray-700 mb-2">How confident Faxi is in its interpretation:</p>
              <ul className="text-gray-700 space-y-1">
                <li>🟢 <strong>High (80-100%)</strong> - Very confident</li>
                <li>🟡 <strong>Medium (50-79%)</strong> - Moderately confident</li>
                <li>🔴 <strong>Low (0-49%)</strong> - Needs clarification</li>
              </ul>
            </div>

            <div className="border-l-4 border-purple-500 pl-6 py-2">
              <h4 className="font-semibold text-lg text-gray-900 mb-2">4. Planned Actions</h4>
              <p className="text-gray-700">
                What Faxi would do in production: send email, search products, create order, register payment, schedule appointment, or update profile.
              </p>
            </div>
          </div>
        </div>

        {/* Common Issues */}
        <div className="mb-12">
          <h3 className="text-3xl font-bold text-faxi-brown mb-6">
            Common Issues
          </h3>

          <div className="space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h4 className="font-semibold text-red-900 mb-2">❌ &quot;Processing Failed&quot; Error</h4>
              <p className="text-red-800 mb-3">
                <strong>Possible causes:</strong> Image quality too low, text not readable, or server connection issue
              </p>
              <p className="text-red-800">
                <strong>Solutions:</strong> Try a clearer image, use a sample fax to verify the system is working, or refresh the page
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h4 className="font-semibold text-yellow-900 mb-2">⚠️ &quot;No Intent Detected&quot; Result</h4>
              <p className="text-yellow-800 mb-3">
                <strong>Possible causes:</strong> Request too vague, handwriting not legible, or missing key information
              </p>
              <p className="text-yellow-800">
                <strong>Solutions:</strong> Be more specific, write more clearly, or include necessary details
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h4 className="font-semibold text-blue-900 mb-2">⏱️ Slow Processing</h4>
              <p className="text-blue-800 mb-3">
                <strong>Normal time:</strong> 5-15 seconds
              </p>
              <p className="text-blue-800">
                <strong>If taking longer:</strong> Large file size, server load, or complex request with multiple intents
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 p-8 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg text-center border border-amber-200">
          <h3 className="text-2xl font-bold text-faxi-brown mb-3">Ready to Try the Demo?</h3>
          <p className="text-gray-700 mb-6">
            Experience AI-powered fax processing firsthand
          </p>
          <a
            href="/demo"
            className="inline-block px-8 py-3 bg-faxi-brown text-white font-semibold rounded-lg hover:bg-faxi-brown/90 transition-colors"
          >
            Go to Interactive Demo
          </a>
        </div>
      </div>
    </section>
  );
}
