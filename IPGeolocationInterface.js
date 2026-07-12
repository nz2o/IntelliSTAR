// Server-side IP geolocation, used to resolve DEFAULT_LOCATION=AUTOMATIC in .env into
// a starting zip code. This runs server-side (not from the browser) so that, for the
// typical self-hosted deployment (server and viewer sharing the same home network's
// public IP), it resolves to the household's own location without the user having to
// type one in.

// Resolve the server's own public IP to a US zip code via the free ipwho.is API.
export async function GetIPLocation() {
  const response = await fetch('https://ipwho.is/');

  if (!response.ok) {
    throw new Error("GetIPLocation: response status:"+response.status);
  }

  const data = await response.json();
  return {
    zip: data.postal,
    city: data.city,
    countryCode: data.country_code,
  };
}
