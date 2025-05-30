'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from "react-markdown";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';

interface UserData {
  name: string;
  email: string;
  dateOfBirth: string;
  timeOfBirth: string;
  placeOfBirth: string;
  selectedLocation: {
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
}

interface AnalysisResult {
  big3: {
    ascendant: string;
    sun: string;
    moon: string;
  };
  planets: { name: string; sign: string }[];
  houses: { house: number; sign: string }[];
  planetInterpretation: string;
  houseInterpretation: string;
}

function isSameUserData(a: any, b: any) {
  if (!a || !b) return false;
  return (
    a.name === b.name &&
    a.email === b.email &&
    a.dateOfBirth === b.dateOfBirth &&
    a.timeOfBirth === b.timeOfBirth &&
    a.placeOfBirth === b.placeOfBirth &&
    JSON.stringify(a.selectedLocation) === JSON.stringify(b.selectedLocation)
  );
}

export default function Analysis() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedData = localStorage.getItem('userData');
    if (!storedData) {
      router.push('/');
      return;
    }
    const data = JSON.parse(storedData);
    setUserData(data);
    // Check for cached analysis
    const cached = localStorage.getItem('analysisResult');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.userData && isSameUserData(parsed.userData, data) && parsed.result) {
          setResult(parsed.result);
          console.log(`parsed.result: ${JSON.stringify(parsed.result)}`);
          setLoading(false);
          return;
        }
      } catch {}
    }
    generateAnalysis(data);
  }, [router]);

  const generateAnalysis = async (data: UserData) => {
    try {
      setLoading(true);
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to generate analysis');
      }
      const analysisResult = await response.json();
      setResult(analysisResult);
      // Save to localStorage for caching
      localStorage.setItem('analysisResult', JSON.stringify({ userData: data, result: analysisResult }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!result || !userData) return;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageHeight = pdf.internal.pageSize.height || 842; // a4 height in pt
    const margin = 40;
    const maxWidth = 520;
    let y = margin;

    pdf.setFontSize(22);
    pdf.text('Spirit Personality Analysis', margin, y);
    y += 30;

    pdf.setFontSize(12);
    pdf.text([
      `Name: ${userData.name}`,
      `Email: ${userData.email}`,
      `Date of Birth: ${userData.dateOfBirth}`,
      `Time of Birth: ${userData.timeOfBirth}`,
      `Place of Birth: ${userData.placeOfBirth}`,
      `Location: ${userData.selectedLocation?.complete_name || ''}`,
    ], margin, y);
    y += 90;

    pdf.setFontSize(16);
    pdf.text(`Big 3: Ascendant (${result.big3.ascendant}), Sun (${result.big3.sun}), Moon (${result.big3.moon})`, margin, y);
    y += 30;

    // Planets Table
    autoTable(pdf, {
      startY: y,
      head: [['Planet', 'Sign']],
      body: result.planets.map(p => [p.name, p.sign]),
      theme: 'grid',
      headStyles: { fillColor: [124, 58, 237] },
      margin: { left: margin },
      styles: { cellPadding: 4, fontSize: 11 },
    });
    y = (pdf as any).lastAutoTable.finalY + 20;

    pdf.setFontSize(14);
    pdf.text('Planets Interpretation:', margin, y);
    y += 20;
    pdf.setFontSize(11);
    // Paginate planet interpretation
    result.planetInterpretation
      .replace(/^```[a-z]*\n?/i, '')
      .replace(/\n?```$/, '')
      .replace(/\*\*/g, '');
    const planetLines = pdf.splitTextToSize(result.planetInterpretation, maxWidth);
    for (let i = 0; i < planetLines.length; i++) {
      if (y + 16 > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(planetLines[i], margin, y);
      y += 14;
    }
    y += 10;

    // Houses Table
    if (y + 60 > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
    autoTable(pdf, {
      startY: y,
      head: [['House', 'Sign']],
      body: result.houses.map(h => [h.house, h.sign]),
      theme: 'grid',
      headStyles: { fillColor: [124, 58, 237] },
      margin: { left: margin },
      styles: { cellPadding: 4, fontSize: 11 },
    });
    y = (pdf as any).lastAutoTable.finalY + 20;

    pdf.setFontSize(14);
    pdf.text('Houses Interpretation:', margin, y);
    y += 20;
    pdf.setFontSize(11);
    // Paginate house interpretation
    result.houseInterpretation
      .replace(/^```[a-z]*\n?/i, '')
      .replace(/\n?```$/, '')
      .replace(/\*\*/g, '');
    const houseLines = pdf.splitTextToSize(result.houseInterpretation, maxWidth);
    for (let i = 0; i < houseLines.length; i++) {
      if (y + 16 > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(houseLines[i], margin, y);
      y += 14;
    }

    pdf.save('spirit-personality-analysis.pdf');
  };

  const handleDownloadImage = async () => {
    if (!resultRef.current) return;
    // Remove 'scale' option as it's not supported by Html2CanvasOptions
    const canvas = await html2canvas(resultRef.current, {
      background: "transparent", // preserves transparency
    });
    const link = document.createElement('a');
    link.download = 'spirit-personality-analysis.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleClearData = () => {
    localStorage.removeItem('userData');
    localStorage.removeItem('analysisResult');
    router.push('/'); // or window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-900 to-indigo-900">
        <div className="text-white text-2xl">Generating your birth chart analysis...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-900 to-indigo-900">
        <div className="text-white text-2xl">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-b from-purple-900 to-indigo-900">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={handleDownloadPDF}
          className="mb-6 w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          Download as PDF
        </button>
        <button
          onClick={handleDownloadImage}
          className="mb-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Download as Image
        </button>
        <div ref={resultRef}>
        {result && (
          <>
            <h1 className="text-4xl font-bold text-white mb-4 text-center">
              Your Big 3: Ascendant {result.big3.ascendant}, Sun {result.big3.sun}, Moon {result.big3.moon}
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="bg-white rounded-lg shadow-xl p-8">
                <h2 className="text-2xl font-bold text-purple-900 mb-4">Planets</h2>
                <table className="w-full text-left mb-4">
                  <thead>
                    <tr>
                      <th className="py-1 px-2">Planet</th>
                      <th className="py-1 px-2">Sign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.planets.map((p, idx) => (
                      <tr key={idx} className="border-b last:border-b-0">
                        <td className="py-1 px-2 text-black font-semibold">{p.name}</td>
                        <td className="py-1 text-black px-2">{p.sign}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3 className="text-lg font-semibold text-purple-800 mb-2">Interpretation</h3>
                <div className="text-gray-700 whitespace-pre-wrap">
                  <ReactMarkdown>{result.planetInterpretation}</ReactMarkdown>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-xl p-8">
                <h2 className="text-2xl font-bold text-purple-900 mb-4">Houses</h2>
                <table className="w-full text-left mb-4">
                  <thead>
                    <tr>
                      <th className="py-1 px-2">House</th>
                      <th className="py-1 px-2">Sign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.houses.map((h, idx) => (
                      <tr key={idx} className="border-b last:border-b-0">
                        <td className="py-1 px-2 text-black font-semibold">{h.house}</td>
                        <td className="py-1 px-2 text-black">{h.sign}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3 className="text-lg font-semibold text-purple-800 mb-2">Interpretation</h3>
                <div className="text-gray-700 whitespace-pre-wrap">
                  <ReactMarkdown>{result.houseInterpretation}</ReactMarkdown>
                </div>
              </div>
            </div>
          </>
        )}
        </div>
        <button
          onClick={handleClearData}
          className="mt-4 w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Clear Data
        </button>
        <button
          onClick={() => router.push('/')}
          className="mt-8 w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
        >
          Start New Analysis
        </button>
      </div>
    </div>
  );
} 