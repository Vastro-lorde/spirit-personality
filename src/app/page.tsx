'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { APP_NAME } from "@/utils/constants";

type LocationType = {
  location_name: string;
  longitude: number;
  latitude: number;
  timezone_offset: number;
  timezone: string;
  complete_name: string;
  country: string;
  administrative_zone_1: string;
  administrative_zone_2: string;
};

export default function Home() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    dateOfBirth: '',
    timeOfBirth: '',
    placeOfBirth: ''
  });
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [locationError, setLocationError] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);
  const [locationOptions, setLocationOptions] = useState<LocationType[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationType | null>(null);

  // Prefill form from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('userData');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setFormData({
          name: parsed.name || '',
          email: parsed.email || '',
          dateOfBirth: parsed.dateOfBirth || '',
          timeOfBirth: parsed.timeOfBirth || '',
          placeOfBirth: parsed.placeOfBirth || ''
        });
        if (parsed.selectedLocation) {
          setSelectedLocation(parsed.selectedLocation);
          setLocationStatus('valid');
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    // Validate all fields and location
    const allFieldsFilled = Object.values(formData).every(Boolean);
    setIsFormValid(
      allFieldsFilled && locationStatus === 'valid' && !!selectedLocation
    );
  }, [formData, locationStatus, selectedLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Save the selected location object in localStorage for later use
    localStorage.setItem('userData', JSON.stringify({ ...formData, selectedLocation }));
    router.push('/analysis');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (name === 'placeOfBirth') {
      setLocationStatus('idle');
      setLocationError('');
      setLocationOptions([]);
      setSelectedLocation(null);
      if (value.length > 2) {
        validateLocationDebounced(value);
      }
    }
  };

  const validateLocation = async (customLocation?: string) => {
    const locationToValidate = customLocation ?? formData.placeOfBirth;
    if (!locationToValidate) return;
    setLocationStatus('loading');
    setLocationError('');
    setLocationOptions([]);
    setSelectedLocation(null);
    try {
      const res = await fetch('/api/validate-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: locationToValidate })
      });
      const data = await res.json();
      if (data.valid && data.locations.length > 0) {
        setLocationOptions(() => [...data.locations]);
        if (data.locations.length === 1) {
          setSelectedLocation(data.locations[0]);
          setFormData(prev => ({
            ...prev,
            placeOfBirth: data.locations[0].complete_name
          }));
          setLocationStatus('valid');
          setLocationError('');
        } else {
          setLocationStatus('idle'); // Wait for user to select
        }
      } else {
        setLocationStatus('invalid');
        setLocationError(data.error || 'Location not found');
      }
    } catch {
      setLocationStatus('invalid');
      setLocationError('Error validating location');
    }
  };

  // Debounce location validation to avoid too many API calls
  const debounce = <A extends unknown[]>(func: (...args: A) => void, delay: number) => {
    let timer: NodeJS.Timeout;
    return (...args: A) => {
      clearTimeout(timer);
      timer = setTimeout(() => func(...args), delay);
    };
  };

  const validateLocationDebounced = debounce<[string]>((location) => validateLocation(location), 500);

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1 className="text-4xl font-bold text-white">Welcome to {APP_NAME}</h1>
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center mb-8 text-purple-900">
            Spirit Personality Analysis
          </h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 text-black block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">
                Date of Birth
              </label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                required
                value={formData.dateOfBirth}
                onChange={handleChange}
                className="mt-1 block w-full text-black rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            <div>
              <label htmlFor="timeOfBirth" className="block text-sm font-medium text-gray-700">
                Time of Birth
              </label>
              <input
                type="time"
                id="timeOfBirth"
                name="timeOfBirth"
                required
                value={formData.timeOfBirth}
                onChange={handleChange}
                className="mt-1 block w-full text-black rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            <div>
              <label htmlFor="placeOfBirth" className="block text-sm font-medium text-gray-700">
                Place of Birth
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  id="placeOfBirth"
                  name="placeOfBirth"
                  required
                  placeholder="City, Country"
                  value={formData.placeOfBirth}
                  onChange={handleChange}
                  onBlur={() => validateLocation()}
                  className="mt-1 block w-full text-black rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 pr-10"
                />
                {locationStatus === 'loading' && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2">
                    <svg className="animate-spin h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                  </span>
                )}
                {locationStatus === 'valid' && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600">✔️</span>
                )}
                {locationStatus === 'invalid' && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-600">❌</span>
                )}
              </div>
              {locationOptions.length > 1 && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-600 mb-1">Select your location:</label>
                  <div className="flex flex-col gap-2">
                    {locationOptions.map((loc, idx) => (
                      <div
                        key={idx}
                        className={`cursor-pointer text-black rounded border px-3 py-2 text-sm transition-colors ${selectedLocation === loc ? 'bg-purple-100 border-purple-600 text-purple-900 font-semibold' : 'bg-white border-gray-300 hover:bg-purple-50'}`}
                        onClick={() => {
                          setSelectedLocation(loc);
                          setLocationStatus('valid');
                          setLocationError('');
                          setFormData(prev => ({
                            ...prev,
                            placeOfBirth: loc.complete_name
                          }));
                        }}
                      >
                        {loc.complete_name || loc.location_name || loc.country}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {locationError && (
                <p className="text-red-600 text-xs mt-1">{locationError}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={!isFormValid}
            >
              Generate Birth Chart
            </button>
          </form>
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-between w-full">
        <p className="text-white">Created by Seun Daniel Omatsola aka Vastrolorde Spiritual</p> 
        <p>{new Date().toLocaleDateString()}</p>
      </footer>
    </div>
  );
}