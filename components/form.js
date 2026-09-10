'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Slider } from '@/components/Slider';
import universityOptions from '@/data/universities.json';
import domainOptions from '@/data/domains.json';

// Base path — must match `basePath` in next.config.mjs.
// next/image src, CSS url(), <video> src, and fetch() do NOT auto-apply basePath,
// so prefix them manually with this.
const BASE_PATH = '/certificate';

// Valid LinkedIn *profile* URL, e.g. https://www.linkedin.com/in/your-name
// Allows an optional subdomain (www, pk, uk…), trailing slash, and ?query params.
const LINKEDIN_REGEX = /^https:\/\/([\w-]+\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]+\/?(\?.*)?$/i;
const LINKEDIN_ERROR = 'Enter a valid LinkedIn profile URL, e.g. https://www.linkedin.com/in/your-name';

// A 4-digit year, allowing some room for currently-enrolled students graduating
// in the future.
const MIN_GRADUATION_YEAR = 1950;
const MAX_GRADUATION_YEAR = new Date().getFullYear() + 10;
const GRADUATION_YEAR_ERROR = `Enter a valid graduation year between ${MIN_GRADUATION_YEAR} and ${MAX_GRADUATION_YEAR}`;

function isValidGraduationYear(value) {
  if (!/^\d{4}$/.test(value)) return false;
  const year = Number(value);
  return year >= MIN_GRADUATION_YEAR && year <= MAX_GRADUATION_YEAR;
}

// Test workshops to see scrollbar (remove this when you have real workshops)
const testWorkshops = [
  "AI Dashboards",
  "Machine Learning Fundamentals", 
  "Data Science Bootcamp",
  "Python Programming",
  "Web Development",
  "Mobile App Development",
  "Cloud Computing",
  "Cybersecurity",
  "Blockchain Technology",
  "DevOps Practices",
  "UI/UX Design",
  "Digital Marketing",
  "Project Management",
  "Business Analytics",
  "Database Management"
];

export default function AssignmentForm() {
  const [formData, setFormData] = useState({
    code: "",
    Name: "",
    Email: "",
    Phone: "",
    University: "",
    Domain: "",
    Graduation_Year: "",
    Workshop: "",
    Linkedin_URL: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [workshopOptions, setWorkshopOptions] = useState([]);
  const [isLoadingWorkshops, setIsLoadingWorkshops] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [linkedinError, setLinkedinError] = useState('');
  const [graduationYearError, setGraduationYearError] = useState('');
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Live-validate the LinkedIn field (only flag once the user has typed something)
    if (name === 'Linkedin_URL') {
      setLinkedinError(value && !LINKEDIN_REGEX.test(value.trim()) ? LINKEDIN_ERROR : '');
    } else if (name === 'Graduation_Year') {
      setGraduationYearError(value && !isValidGraduationYear(value.trim()) ? GRADUATION_YEAR_ERROR : '');
    }
  };

  const handleWorkshopSelect = (value) => {
    setFormData((prev) => ({ ...prev, Workshop: value }));
  };

  const handleUniversitySelect = (value) => {
    setFormData((prev) => ({ ...prev, University: value }));
  };

  const handleDomainSelect = (value) => {
    setFormData((prev) => ({ ...prev, Domain: value }));
  };

  // Fetch workshop names from API when component mounts
  useEffect(() => {
    const fetchWorkshops = async () => {
      try {
        const response = await fetch(`${BASE_PATH}/api/workshops`);
        if (response.ok) {
          const data = await response.json();
          setWorkshopOptions(data.workshops || testWorkshops);
        } else {
          console.error('Failed to fetch workshops');
          setWorkshopOptions(testWorkshops);
        }
      } catch (error) {
        console.error('Error fetching workshops:', error);
        setWorkshopOptions(testWorkshops);
      } finally {
        setIsLoadingWorkshops(false);
      }
    };

    fetchWorkshops();
  }, []);

  // Auto-refresh after 5 seconds when success modal is shown
  useEffect(() => {
    if (showSuccessModal) {
      const timer = setTimeout(() => {
        window.location.reload();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessModal]);

  // Auto-close after 5 seconds when warning modal is shown
  useEffect(() => {
    if (showWarningModal) {
      const timer = setTimeout(() => {
        setShowWarningModal(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showWarningModal]);


  const isSubmittingRef = React.useRef(false);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    // Clone and normalize phone number
    let normalizedPhone = formData.Phone || formData.phone || '';
    normalizedPhone = normalizedPhone.startsWith('0') ? `+92${normalizedPhone.slice(1)}` : normalizedPhone;

    // Build normalized form data object with phone fixed
    const normalizedFormData = {
      ...formData,
      Phone: normalizedPhone,
    };

    // Simple validation: check all fields filled
    for (const key in normalizedFormData) {
      if (!normalizedFormData[key]) {
        const fieldName = key.replace(/_/g, " ").toLowerCase();
        setWarningMessage(`Please complete the ${fieldName} field to continue with your certificate application.`);
        setShowWarningModal(true);
        return;
      }
    }

    // LinkedIn URL validation
    if (!LINKEDIN_REGEX.test(normalizedFormData.Linkedin_URL.trim())) {
      setLinkedinError(LINKEDIN_ERROR);
      setWarningMessage(LINKEDIN_ERROR);
      setShowWarningModal(true);
      return;
    }

    // Graduation year validation
    if (!isValidGraduationYear(normalizedFormData.Graduation_Year.trim())) {
      setGraduationYearError(GRADUATION_YEAR_ERROR);
      setWarningMessage(GRADUATION_YEAR_ERROR);
      setShowWarningModal(true);
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const response = await fetch(`${BASE_PATH}/api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedFormData),
      });

      const result = await response.json();

      if (response.ok && result.result === "success") {
        setShowSuccessModal(true);

        // Reset form
        setFormData({
          code: "",
          Name: "",
          Email: "",
          Phone: "",
          University: "",
          Domain: "",
          Graduation_Year: "",
          Workshop: "",
          Linkedin_URL: "",
        });
        setLinkedinError('');
        setGraduationYearError('');
      } else {
        if (result.error === "Invalid code or workshop.") {
          setWarningMessage("Please check your secret code and workshop selection. Make sure they match exactly.");
        } else if (response.status === 409) {
          setWarningMessage(result.error);
        } else {
          setWarningMessage("We encountered an issue processing your request. Please try again in a moment.");
        }
        setShowWarningModal(true);
      }
    } catch (error) {
      setWarningMessage("We're experiencing some technical difficulties. Please check your internet connection and try again.");
      setShowWarningModal(true);
    } finally {
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  // Slider images - using available images from certificate-frontend
  const sliderImages = [
    `${BASE_PATH}/images/1.png`,
    `${BASE_PATH}/images/2.png`,
    `${BASE_PATH}/images/3.png`,
  ].filter(Boolean); // Remove undefined values

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 relative overflow-y-auto bg-gray-900">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src={`${BASE_PATH}/images/bg.webp`}
          alt="Background Image"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-[1200px] bg-white rounded-3xl shadow-2xl flex flex-col xl:flex-row xl:max-h-[900px] xl:overflow-hidden my-auto">
        {/* Left Side: Form */}
        <div className="w-full xl:w-1/2 p-4 sm:p-6 flex flex-col justify-center">
          {/* Logo Area */}
          <div className="flex items-center">
            <Image
              src={`${BASE_PATH}/images/datacrumbs-light.png`}
              alt="Site Logo"
              width={200}
              height={50}
              className="h-14 sm:h-20 w-auto object-contain"
              quality={100}
              priority
              unoptimized
              />
            </div>

          {/* Headlines */}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 mb-1 sm:mb-2 leading-tight">
            Claim Your Workshop Certificate
          </h1>
          <p className="text-gray-500 text-xs md:text-sm leading-relaxed max-w-md">
            Complete the form below to receive your workshop certificate.
          </p>

          {/* Divider */}
          <div className="relative py-2 sm:py-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
              </div>

          <form className="space-y-2.5 sm:space-y-3" onSubmit={handleSubmit}>
              {/* Name */}
            <div>
              <Input
                id="Name"
                  type="text"
                  name="Name"
                  value={formData.Name}
                  onChange={handleChange}
                placeholder="Full Name"
                className="w-full h-11 bg-gray-50 border border-gray-200 focus:bg-white focus:border-gray-400 focus:ring-0 rounded-lg text-gray-900 placeholder:text-gray-400"
                  required
                />
              </div>

            {/* Email and Phone in a row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div>
                <Input
                  id="Email"
                  type="email"
                  name="Email"
                  value={formData.Email}
                  onChange={handleChange}
                  placeholder="Email"
                  className="w-full h-11 bg-gray-50 border border-gray-200 focus:bg-white focus:border-gray-400 focus:ring-0 rounded-lg text-gray-900 placeholder:text-gray-400"
                  required
                />
              </div>
              <div>
                <Input
                  id="Phone"
                  type="tel"
                  name="Phone"
                  value={formData.Phone}
                  onChange={handleChange}
                  placeholder="Phone Number"
                  className="w-full h-11 bg-gray-50 border border-gray-200 focus:bg-white focus:border-gray-400 focus:ring-0 rounded-lg text-gray-900 placeholder:text-gray-400"
                  required
                />
              </div>
              </div>

              {/* University */}
            <div>
              <SearchableSelect
                value={formData.University}
                onValueChange={handleUniversitySelect}
                options={universityOptions}
                placeholder="Choose university"
                searchPlaceholder="Search universities..."
                triggerClassName="w-full !h-11 bg-gray-50 border border-gray-200 focus:bg-white focus:border-gray-400 focus:ring-0 rounded-lg text-gray-900 placeholder:text-gray-400"
              />
            </div>

            {/* Domain and Graduation Year in a row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div>
                <SearchableSelect
                  value={formData.Domain}
                  onValueChange={handleDomainSelect}
                  options={domainOptions}
                  placeholder="Choose domain"
                  searchPlaceholder="Search domains..."
                  triggerClassName="w-full !h-11 bg-gray-50 border border-gray-200 focus:bg-white focus:border-gray-400 focus:ring-0 rounded-lg text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <div>
                <Input
                  id="Graduation_Year"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  name="Graduation_Year"
                  value={formData.Graduation_Year}
                  onChange={handleChange}
                  placeholder="Graduation Year"
                  aria-invalid={graduationYearError ? true : false}
                  className={`w-full h-11 bg-gray-50 border focus:bg-white focus:ring-0 rounded-lg text-gray-900 placeholder:text-gray-400 ${
                    graduationYearError
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-gray-200 focus:border-gray-400'
                  }`}
                  required
                />
                {graduationYearError && (
                  <p className="mt-1 text-xs text-red-500">{graduationYearError}</p>
                )}
              </div>
              </div>

              {/* LinkedIn URL */}
            <div>
              <Input
                id="Linkedin_URL"
                  type="url"
                  name="Linkedin_URL"
                  value={formData.Linkedin_URL}
                  onChange={handleChange}
                placeholder="https://www.linkedin.com/in/your-profile"
                aria-invalid={linkedinError ? true : false}
                className={`w-full h-11 bg-gray-50 border focus:bg-white focus:ring-0 rounded-lg text-gray-900 placeholder:text-gray-400 ${
                  linkedinError
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-gray-200 focus:border-gray-400'
                }`}
                  required
                />
              {linkedinError && (
                <p className="mt-1 text-xs text-red-500">{linkedinError}</p>
              )}
              </div>

            {/* Masterclass Code */}
            <div>
              <Input
                id="code"
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="Masterclass Code"
                className="w-full h-11 bg-gray-50 border border-gray-200 focus:bg-white focus:border-gray-400 focus:ring-0 rounded-lg text-gray-900 placeholder:text-gray-400"
                required
              />
            </div>

            {/* Workshop Dropdown */}
            <div>
              <SearchableSelect
                value={formData.Workshop}
                onValueChange={handleWorkshopSelect}
                options={workshopOptions}
                isLoading={isLoadingWorkshops}
                loadingPlaceholder="Loading workshops..."
                placeholder="Choose workshop"
                searchPlaceholder="Search workshops..."
                emptyMessage="No workshops available"
                triggerClassName="w-full !h-11 bg-gray-50 border border-gray-200 focus:bg-white focus:border-gray-400 focus:ring-0 rounded-lg text-gray-900 placeholder:text-gray-400"
              />
            </div>

            {/* Submit Button */}
                <button
                type="submit"
              disabled={isLoading}
              className="w-full mt-4 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 flex items-center justify-center relative overflow-hidden cursor-pointer"
              style={{
                backgroundImage: `url(${BASE_PATH}/images/button2.webp)`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              {/* Dark overlay for text readability with interactive states */}
              <div className="absolute inset-0 bg-black/20 hover:bg-black/50 active:bg-black/70 transition-colors rounded-lg pointer-events-none"></div>
              <span className="text-lg relative z-10">
                {isLoading ? "Submitting..." : "Submit"}
              </span>
                </button>
            </form>
          </div>

        {/* Right Side: Visual */}
        <div className="hidden lg:flex w-1/2">
          {sliderImages.length > 0 ? (
            <Slider images={sliderImages} />
          ) : (
            <div
              className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url('${BASE_PATH}/bgpic.png')` }}
          />
          )}
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Very Light Blur Overlay */}
          <div className="absolute inset-0 backdrop-blur-[2px] bg-black/50"></div>
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-2xl p-4 max-w-xl ml-4 shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setShowSuccessModal(false)}
              className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center space-x-6">
              <div className="w-16 h-16 rounded-full overflow-hidden shadow-lg flex-shrink-0">
                <video 
                  className="w-full h-full object-cover" 
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                >
                  <source src={`${BASE_PATH}/correct video.mp4`} type="video/mp4" />
                </video>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-800 mb-0">
                  Certificate Application Submitted
                </h3>
                <p className="text-gray-600">
                  Your request for the Masterclass Certificate has been submitted successfully. You'll receive your certificate within 15-30 mins.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Very Light Blur Overlay */}
          <div className="absolute inset-0 backdrop-blur-[2px] bg-black/50"></div>
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-2xl p-4 max-w-xl ml-4 shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setShowWarningModal(false)}
              className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center space-x-6">
              <div className="w-16 h-16 rounded-full overflow-hidden shadow-lg flex-shrink-0">
                <video 
                  className="w-full h-full object-cover" 
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                >
                  <source src={`${BASE_PATH}/warning video.mp4`} type="video/mp4" />
                </video>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-800 mb-0">
                  Submission Failed
                </h3>
                <p className="text-gray-600">
                  {warningMessage}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
