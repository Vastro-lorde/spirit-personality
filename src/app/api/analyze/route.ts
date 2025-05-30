import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const apiKey = process.env.GEMINI_API_KEY as string;
const astrologyApiKey = process.env.FREE_ASTROLOGY_API_KEY2 as string;
if (!apiKey) throw new Error('GEMINI_API_KEY is not set in environment variables');
if (!astrologyApiKey) throw new Error('FREE_ASTROLOGY_API_KEY is not set in environment variables');
const genAI = new GoogleGenerativeAI(apiKey);

const ASTROLOGY_API_BASE = 'https://json.freeastrologyapi.com';

interface PlanetData {
  planet: { en: string };
  zodiac_sign: { name: { en: string } };
}
interface HouseData {
  House: number;
  zodiac_sign: { name: { en: string } };
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { name, dateOfBirth, timeOfBirth, selectedLocation } = data;
    if (!selectedLocation) {
      return NextResponse.json({ error: 'Location not selected' }, { status: 400 });
    }
    const { latitude, longitude, timezone_offset } = selectedLocation;
    const timezone = timezone_offset;
    // Parse date and time
    // dateOfBirth: YYYY-MM-DD, timeOfBirth: HH:mm (or HH:mm:ss)
    const [year, month, day] = dateOfBirth.split('-').map(Number);
    const [hour, minute, secondRaw] = timeOfBirth.split(':').map(Number);
    const second = typeof secondRaw === 'number' && !isNaN(secondRaw) ? secondRaw : 0;
    // 1. Get Planets
    console.log(`astrologyApiKey: ${astrologyApiKey}`);
    console.log(`year: ${year}, month: ${month}, day: ${day}, hour: ${hour}, minute: ${minute}, second: ${second}`);
    console.log(`latitude: ${latitude}, longitude: ${longitude}, timezone: ${timezone}`);
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': astrologyApiKey,
    };
    const body = JSON.stringify({
      year: year,
      month: month,
      date: day,
      hours: hour,
      minutes: minute,
      seconds: second,
      latitude: latitude,
      longitude: longitude,
      timezone: timezone,
    });
    
    const planetRes = await fetch(`${ASTROLOGY_API_BASE}/western/planets`, {
      method: 'POST',
      headers,
      body: body,
    });
    const planetData = await planetRes.json();
    setTimeout(() =>{
      console.log(`planetData: ${JSON.stringify(planetData)}`);
    }, 3000);
    // 2. Get Houses
    console.log(`headers: ${JSON.stringify(headers)}`);
    console.log(`body: ${body}`);
    const houseRes = await fetch(`${ASTROLOGY_API_BASE}/western/houses`, {
      method: 'POST',
      headers,
      body: body,
    });
    const houseData = await houseRes.json();

    console.log(planetData);
    console.log(houseData);
    // 3. Filter Planets: get planet name and sign
    const planets = (planetData.output || []).map((p: PlanetData) => ({
      name: p?.planet?.en,
      sign: p?.zodiac_sign?.name?.en
    }));
    // 4. Filter Houses: get house number and sign
    const houses = (houseData.output?.Houses || []).map((h: HouseData) => ({
      house: h.House,
      sign: h.zodiac_sign?.name?.en
    }));
    // 5. Get Big 3: Ascendant, Sun, Moon
    const ascendant = planets.find((p: { name: string; }) => p.name.toLowerCase() === 'ascendant')?.sign || '';
    const sun = planets.find((p: { name: string; }) => p.name.toLowerCase() === 'sun')?.sign || '';
    const moon = planets.find((p: { name: string; }) => p.name.toLowerCase() === 'moon')?.sign || '';
    // 6. Gemini prompt for planets
    let planetInterpretation = '';
    if (planets.length > 0) {
      const planetPrompt = `In short and concise way, Interpret the following astrological planet placements for ${name} (${planets.map((p: { name: any; }) => p.name).join(', ')}). For each, explain what it means for the personality.\n\n${JSON.stringify(planets, null, 2)} return in markdown format and 1000 characters or less`;
      const planetModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const planetResult = await planetModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: planetPrompt }] }],
        generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 1024 },
      });
      planetInterpretation = planetResult.response.text().trim();
    } else {
      planetInterpretation = 'No planet data available.';
    }
    // 7. Gemini prompt for houses
    let houseInterpretation = '';
    if (houses.length > 0) {
      const housePrompt = `In short and concise way, Interpret the following astrological house placements for ${name}. For each house, explain what the sign means for the personality.\n\n${JSON.stringify(houses, null, 2)} return in markdown format and 1000 characters or less`;
      const houseModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const houseResult = await houseModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: housePrompt }] }],
        generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 1024 },
      });
      houseInterpretation = houseResult.response.text().trim();
    } else {
      houseInterpretation = 'No house data available.';
    }
    if (planets.length === 0 && houses.length === 0) {
      return NextResponse.json({ error: 'No data available' }, { status: 400 });
    }
    return NextResponse.json({
      big3: { ascendant, sun, moon },
      planets,
      houses,
      planetInterpretation,
      houseInterpretation
    });
  } catch (error) {
    console.error('Error generating analysis:', error);
    return NextResponse.json(
      { error: 'Failed to generate analysis. Please check your API key and try again.' },
      { status: 500 }
    );
  }
} 