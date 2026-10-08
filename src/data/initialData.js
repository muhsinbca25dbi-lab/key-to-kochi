export const INITIAL_LOCATIONS = [
  { id: 'loc-1', name: 'Kakkanad', landmark: 'Infopark & SmartCity IT Hub', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80', description: 'Kochi’s prime IT corridor with contemporary high-rise towers and vibrant nightlife.' },
  { id: 'loc-2', name: 'Edappally', landmark: 'LuLu Mall & Metro Interchange', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80', description: 'Central retail epicenter with rapid metro connectivity and premium gated communities.' },
  { id: 'loc-3', name: 'Panampilly Nagar', landmark: 'Boutique Cafes & Luxury Enclave', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80', description: 'Prestigious residential boulevard famous for luxury bungalows and leafy avenues.' },
  { id: 'loc-4', name: 'Marine Drive', landmark: 'Vembanad Lakefront Promenade', image: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=800&q=80', description: 'Iconic scenic waterfront apartments overlooking Cochin Port and backwaters.' },
  { id: 'loc-5', name: 'Vyttila', landmark: 'Vyttila Mobility Hub & Water Metro', image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80', description: 'Kerala’s largest multimodal transportation hub with high rental demand.' },
  { id: 'loc-6', name: 'Kadavanthra', landmark: 'South Kochi Central Commercial Hub', image: 'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=800&q=80', description: 'Peaceful upscale urban neighborhood with prime hospitals and schools.' },
  { id: 'loc-7', name: 'Fort Kochi', landmark: 'Colonial Heritage & Coastal Charm', image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80', description: 'Historic seaside town with classic architecture, art cafes, and sea breeze.' },
  { id: 'loc-8', name: 'Palarivattom', landmark: 'Bypass Hub & Medical Centres', image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80', description: 'Strategic node connecting NH bypass, Kakkanad Infopark, and MG Road.' },
  { id: 'loc-9', name: 'Kaloor', landmark: 'Jawaharlal Nehru Stadium', image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=800&q=80', description: 'Lively urban area with great dining, sports culture, and direct metro access.' },
  { id: 'loc-10', name: 'Thrippunithura', landmark: 'Hill Palace & Royal Heritage', image: 'https://images.unsplash.com/photo-1600573472591-ee6c563aaec9?auto=format&fit=crop&w=800&q=80', description: 'Cultural heartland of Kochi with tranquil traditional living and modern high-rises.' },
  { id: 'loc-11', name: 'Maradu', landmark: 'Kundannoor Junction & Luxury Hotels', image: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=800&q=80', description: 'Southern growth corridor close to Crowne Plaza and lakeside residences.' },
  { id: 'loc-12', name: 'Aluva', landmark: 'Periyar Riverfront & Metro Terminal', image: 'https://images.unsplash.com/photo-1600607687644-c7171b42498b?auto=format&fit=crop&w=800&q=80', description: 'Green riverfront city with quick airport access and seamless metro line.' }
];

export const TENANT_TYPES = ['Family', 'Bachelors', 'Couples'];

export const TENANT_TYPE_CONFIG = {
  Family: {
    label: 'Family Friendly',
    badge: '👨‍👩‍👧 Family',
    icon: '👨‍👩‍👧',
    tagline: 'Spacious living areas & family-oriented locations',
    desc: 'Spacious layouts, near schools, hospitals & secure communities.'
  },
  Bachelors: {
    label: 'Bachelor Friendly',
    badge: '👤 Bachelors',
    icon: '👤',
    tagline: 'Ideal for working professionals & students',
    desc: 'Rapid transit access, near Infopark / colleges & commercial hubs.'
  },
  Couples: {
    label: 'Couple Friendly',
    badge: '❤️ Couples',
    icon: '❤️',
    tagline: 'Privacy-focused & modern convenience',
    desc: 'Contemporary aesthetics, scenic balconies & peaceful living.'
  }
};

export const INITIAL_PROPERTIES = [
  {
    id: 'prop-1',
    title: 'Modern 1 BHK Tech-Suite at Infopark Expressway',
    type: 'Apartment',
    bhk: '1 BHK',
    rent: 18500,
    deposit: 45000,
    location: 'Kakkanad',
    address: 'Near SmartCity Phase II, Infopark Expressway, Kakkanad, Kochi 682042',
    size: 680,
    bedrooms: 1,
    bathrooms: 1,
    furnishing: 'Fully Furnished',
    suitableFor: ['Bachelors', 'Couples'],
    availability: 'Available',
    featured: true,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Designed specifically for IT professionals and modern couples, this aesthetic 1 BHK apartment offers high-speed Wi-Fi, ergonomic work desk, imported recliner, modular German kitchen, and uninterrupted power backup. Located just 3 minutes from Infopark South Gate with stunning open green views.',
    facilities: ['Parking', 'Wi-Fi', 'AC', 'Lift', 'Security', 'Water Supply', 'Power Backup', 'Attached Bathroom', 'Kitchen', 'Balcony', 'Gym'],
    owner: { name: 'Mathew Varghese', phone: '+91 98471 22890', email: 'mathew.varghese@keytokochi.com' },
    createdAt: '2026-09-15T10:00:00.000Z'
  },
  {
    id: 'prop-2',
    title: '2 BHK Family Flat near LuLu Mall & Metro Station',
    type: 'Flat',
    bhk: '2 BHK',
    rent: 28000,
    deposit: 70000,
    location: 'Edappally',
    address: 'Skyline Gardenia, NH 66 Bypass, Near Edappally Toll, Kochi 682024',
    size: 1150,
    bedrooms: 2,
    bathrooms: 2,
    furnishing: 'Semi Furnished',
    suitableFor: ['Family'],
    availability: 'Available',
    featured: true,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1502005229762-ae1b4640020c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'A spacious and sunlit 2 BHK family flat inside a gated luxury community. Comes with wooden wardrobes, modern modular kitchen with gas piping, reserved covered car park, 24/7 security with CCTV surveillance, and children play park. Walkable distance to Edappally Metro station and LuLu International Shopping Mall.',
    facilities: ['Parking', 'Lift', 'Security', 'Water Supply', 'Power Backup', 'Attached Bathroom', 'Kitchen', 'Balcony', 'Gym', 'Pet Friendly'],
    owner: { name: 'Priya Nambiar', phone: '+91 94470 19342', email: 'priya.nambiar@keytokochi.com' },
    createdAt: '2026-09-18T14:30:00.000Z'
  },
  {
    id: 'prop-3',
    title: 'Luxury 3 BHK Lakeview Sky Villa at Vyttila Mobility Hub',
    type: 'Apartment',
    bhk: '3 BHK',
    rent: 46000,
    deposit: 120000,
    location: 'Vyttila',
    address: 'Prestige Waterfront Residences, Kaniyampuzha Road, Vyttila, Kochi 682019',
    size: 1980,
    bedrooms: 3,
    bathrooms: 3,
    furnishing: 'Fully Furnished',
    suitableFor: ['Family', 'Couples'],
    availability: 'Available',
    featured: true,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Breathtaking 14th-floor waterfront 3 BHK luxury residence with panoramic backwater views. Architecturally curated Italian marble floors, centralized climate control, smart home automation, rooftop infinity pool, multi-court clubhouse, and 2 dedicated basement parking slots. 5 minutes to Vyttila Water Metro.',
    facilities: ['Parking', 'Wi-Fi', 'AC', 'Lift', 'Security', 'Water Supply', 'Power Backup', 'Attached Bathroom', 'Kitchen', 'Balcony', 'Gym', 'Swimming Pool', 'Pet Friendly'],
    owner: { name: 'K. R. Menon', phone: '+91 97455 88201', email: 'krmenon@keytokochi.com' },
    createdAt: '2026-09-20T09:15:00.000Z'
  },
  {
    id: 'prop-4',
    title: 'Premium 4 BHK Independent Villa in Panampilly Nagar',
    type: 'Home',
    bhk: '4 BHK',
    rent: 85000,
    deposit: 250000,
    location: 'Panampilly Nagar',
    address: 'Main Avenue, Near Central Park, Panampilly Nagar, Kochi 682036',
    size: 3400,
    bedrooms: 4,
    bathrooms: 4,
    furnishing: 'Fully Furnished',
    suitableFor: ['Family'],
    availability: 'Available',
    featured: true,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'An exclusive standalone architect-designed bungalow in Kochi’s elite residential district. Features private landscaped tropical lawn, double-height living room with teakwood craftsmanship, home cinema lounge, servant quarters with private bath, and 3-car private garage. Walking distance to upscale boutiques and organic cafes.',
    facilities: ['Parking', 'Wi-Fi', 'AC', 'Security', 'Water Supply', 'Power Backup', 'Attached Bathroom', 'Kitchen', 'Balcony', 'Pet Friendly'],
    owner: { name: 'Ananya Kurian', phone: '+91 99951 44550', email: 'ananya.kurian@keytokochi.com' },
    createdAt: '2026-09-22T16:00:00.000Z'
  },
  {
    id: 'prop-5',
    title: 'Chic 2 BHK Marine Drive Backwater View Flat',
    type: 'Flat',
    bhk: '2 BHK',
    rent: 36000,
    deposit: 90000,
    location: 'Marine Drive',
    address: 'Purva GrandBay, Marine Drive Walkway, Shanmugham Road, Kochi 682031',
    size: 1320,
    bedrooms: 2,
    bathrooms: 2,
    furnishing: 'Fully Furnished',
    suitableFor: ['Couples', 'Family'],
    availability: 'Rented',
    featured: false,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Iconic city and backwater views from your spacious private balcony. Modern open-plan kitchen, soundproof French windows, infinity gym on 22nd floor, high-speed elevators, and biometric door lock. Steps away from Rainbow Bridge and Marine Drive boat jetty.',
    facilities: ['Parking', 'Wi-Fi', 'AC', 'Lift', 'Security', 'Water Supply', 'Power Backup', 'Attached Bathroom', 'Kitchen', 'Balcony', 'Gym'],
    owner: { name: 'George Thomas', phone: '+91 98460 77112', email: 'george.thomas@keytokochi.com' },
    createdAt: '2026-09-25T11:20:00.000Z'
  },
  {
    id: 'prop-6',
    title: 'Heritage Style 3 BHK Traditional Home in Fort Kochi',
    type: 'Home',
    bhk: '3 BHK',
    rent: 52000,
    deposit: 150000,
    location: 'Fort Kochi',
    address: 'Princess Street Lane, Near Dutch Cemetery, Fort Kochi 682001',
    size: 2150,
    bedrooms: 3,
    bathrooms: 3,
    furnishing: 'Semi Furnished',
    suitableFor: ['Family', 'Couples'],
    availability: 'Available',
    featured: false,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600573472591-ee6c563aaec9?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'A restored colonial villa with terracotta tiled roof, antique wooden rafters, courtyards (Nadumuttam), modern updated en-suite bathrooms, and peaceful garden. Ideal for expatriates, artists, or families who cherish historic elegance.',
    facilities: ['Parking', 'Wi-Fi', 'Security', 'Water Supply', 'Power Backup', 'Attached Bathroom', 'Kitchen', 'Balcony', 'Pet Friendly'],
    owner: { name: 'Francis Xavier', phone: '+91 97463 33100', email: 'francis.xavier@keytokochi.com' },
    createdAt: '2026-09-28T15:45:00.000Z'
  },
  {
    id: 'prop-7',
    title: 'Minimalist 1 BHK Studio Apartment at Palarivattom Bypass',
    type: 'Apartment',
    bhk: '1 BHK',
    rent: 16000,
    deposit: 40000,
    location: 'Palarivattom',
    address: 'Near Pipeline Junction, Palarivattom, Kochi 682025',
    size: 550,
    bedrooms: 1,
    bathrooms: 1,
    furnishing: 'Unfurnished',
    suitableFor: ['Bachelors'],
    availability: 'Available',
    featured: false,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Bright and clean unfurnished 1 BHK flat perfect for working bachelors or individuals wishing to furnish according to their own taste. Features granite kitchen slab, tiled flooring, 24-hour corporation water, lift, and two-wheeler parking.',
    facilities: ['Lift', 'Security', 'Water Supply', 'Power Backup', 'Attached Bathroom', 'Kitchen', 'Balcony'],
    owner: { name: 'Deepa Ramesh', phone: '+91 94462 89011', email: 'deepa.ramesh@keytokochi.com' },
    createdAt: '2026-10-01T08:30:00.000Z'
  },
  {
    id: 'prop-8',
    title: 'Regal 4 BHK Waterfront Penthouse at Kadavanthra',
    type: 'Apartment',
    bhk: '4 BHK',
    rent: 92000,
    deposit: 280000,
    location: 'Kadavanthra',
    address: 'Asset Kasavu, G.C.D.A Complex Road, Kadavanthra, Kochi 682020',
    size: 3850,
    bedrooms: 4,
    bathrooms: 4,
    furnishing: 'Fully Furnished',
    suitableFor: ['Family', 'Couples'],
    availability: 'Available',
    featured: true,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'The pinnacle of luxury in central Kochi. Spanning the top two floors with private rooftop jacuzzi, double-height glass facade, customized Miele kitchen appliances, audio acoustic insulation, 24/7 concierge, and 3 covered car parks.',
    facilities: ['Parking', 'Wi-Fi', 'AC', 'Lift', 'Security', 'Water Supply', 'Power Backup', 'Attached Bathroom', 'Kitchen', 'Balcony', 'Gym', 'Swimming Pool', 'Pet Friendly'],
    owner: { name: 'Dr. Joseph Abraham', phone: '+91 98470 55410', email: 'dr.joseph@keytokochi.com' },
    createdAt: '2026-10-02T13:00:00.000Z'
  },
  {
    id: 'prop-9',
    title: 'Peaceful 2 BHK Independent Home with Garden at Thrippunithura',
    type: 'Home',
    bhk: '2 BHK',
    rent: 22000,
    deposit: 55000,
    location: 'Thrippunithura',
    address: 'Near Statue Junction, Palace Road, Thrippunithura, Kochi 682301',
    size: 1400,
    bedrooms: 2,
    bathrooms: 2,
    furnishing: 'Unfurnished',
    suitableFor: ['Family'],
    availability: 'Available',
    featured: false,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1598228723793-52759bba239c?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Standalone independent house in a serene residential colony. Features private car porch, borewell & corporation water connection, mature mango and coconut trees, quiet neighborhood, and close proximity to Thrippunithura Metro Terminal.',
    facilities: ['Parking', 'Security', 'Water Supply', 'Attached Bathroom', 'Kitchen', 'Balcony', 'Pet Friendly'],
    owner: { name: 'Sujith Kumar', phone: '+91 93499 12345', email: 'sujith.kumar@keytokochi.com' },
    createdAt: '2026-10-03T10:15:00.000Z'
  },
  {
    id: 'prop-10',
    title: 'Executive 3 BHK Flat at Kaloor Stadium Road',
    type: 'Flat',
    bhk: '3 BHK',
    rent: 38000,
    deposit: 95000,
    location: 'Kaloor',
    address: 'Abad Silver Crest, Stadium Link Road, Kaloor, Kochi 682017',
    size: 1650,
    bedrooms: 3,
    bathrooms: 3,
    furnishing: 'Semi Furnished',
    suitableFor: ['Family', 'Bachelors'],
    availability: 'Rented',
    featured: false,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Well-appointed flat in a prime residential tower. Walking distance to Kaloor Metro, international stadium, leading hospitals, and gourmet supermarkets. Features covered parking, club hall, and 24/7 security.',
    facilities: ['Parking', 'Lift', 'Security', 'Water Supply', 'Power Backup', 'Attached Bathroom', 'Kitchen', 'Balcony', 'Gym'],
    owner: { name: 'Manoj Pillai', phone: '+91 98950 67890', email: 'manoj.pillai@keytokochi.com' },
    createdAt: '2026-10-04T12:00:00.000Z'
  }
];

export const INITIAL_ENQUIRIES = [
  {
    id: 'enq-1',
    propertyId: 'prop-1',
    propertyTitle: 'Modern 1 BHK Tech-Suite at Infopark Expressway',
    customerName: 'Rohit Chandran',
    email: 'rohit.c@infosys.com',
    phone: '+91 98471 99002',
    date: '2026-10-05',
    status: 'New',
    isRead: false,
    message: 'Relocating from Bengaluru to Infopark next month. Is this available for immediate move-in? Would love to inspect this weekend.'
  },
  {
    id: 'enq-2',
    propertyId: 'prop-3',
    propertyTitle: 'Luxury 3 BHK Lakeview Sky Villa at Vyttila Mobility Hub',
    customerName: 'Sneha & Arun Nair',
    email: 'sneha.nair@gmail.com',
    phone: '+91 94473 11223',
    date: '2026-10-06',
    status: 'Contacted',
    isRead: true,
    message: 'Interested in a long-term 2-year lease. Can we schedule a video walk-through or in-person visit on Saturday?'
  },
  {
    id: 'enq-3',
    propertyId: 'prop-2',
    propertyTitle: '2 BHK Family Flat near LuLu Mall & Metro Station',
    customerName: 'Faizal Mohammed',
    email: 'faizal.m@qatarair.com',
    phone: '+91 97450 88991',
    date: '2026-10-07',
    status: 'Closed',
    isRead: true,
    message: 'Need family flat near LuLu Edappally. Lease agreement initiated.'
  }
];

export const INITIAL_OWNER_SUBMISSIONS = [
  {
    id: 'sub-1',
    ownerName: 'Vipin George',
    phone: '+91 98462 55512',
    email: 'vipin.george@gmail.com',
    title: 'Brand New 3 BHK Skyline Apartment near Infopark Gate 1',
    type: 'Apartment',
    bhk: '3 BHK',
    location: 'Kakkanad',
    rent: 32000,
    deposit: 80000,
    size: 1550,
    furnishing: 'Semi Furnished',
    suitableFor: ['Family', 'Couples'],
    facilities: ['Parking', 'Lift', 'Security', 'Water Supply', 'Power Backup', 'Attached Bathroom', 'Kitchen', 'Balcony', 'Gym', 'Swimming Pool'],
    description: 'Newly handed-over luxury tower, 9th floor, cross-ventilation, AC in all bedrooms, covered car park, ready to occupy.',
    images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'],
    status: 'Pending',
    date: '2026-10-07'
  }
];

export const CURATED_IMAGE_PRESETS = [
  { label: 'Modern Highrise Apartment', url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Luxury Villa Exterior', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Living Room & Balcony', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Master Bedroom Suite', url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Designer Modular Kitchen', url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Backwater Waterfront View', url: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Traditional Kerala Courtyard', url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Modern Flat Interior', url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80' }
];
