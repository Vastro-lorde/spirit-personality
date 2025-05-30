import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { location } = await request.json();
  const apiKey = process.env.FREE_ASTROLOGY_API_KEY2;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not set' }, { status: 500 });
  }

  const res = await fetch('https://json.freeastrologyapi.com/geo-details', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ location }),
  });

  const data = await res.json();
  console.log(data, location);

  // If the API returns a list, use it. If it returns a single object, wrap it in an array.
  let locations = [];
  if (Array.isArray(data)) {
    locations = data;
  } else if (data && (data.longitude && data.latitude)) {
    locations = [data];
  }
  if (locations.length > 0) {
    return NextResponse.json({ valid: true, locations });
  } else {
    return NextResponse.json({ valid: false, locations: [], error: 'Location not found' }, { status: 400 });
  }
} 