// Set 1 "The Solar Neighborhood": one collectible card per object in the combat roster.
// `name` must exactly match the realPlanets.ts entry - the card's artwork IS that live
// shader profile. Rarity/pool data is mirrored to TelegramBot/cardPool.json (regenerate
// with `npm run gen:cardpool` after editing). Facts stay at NASA-fact-sheet level.
export type CardRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'ultra'

export interface CardDefinition {
  /** stable id used by the server inventory - never rename */
  id: string
  /** collection number within the set (display: "023/066") */
  no: number
  /** exact realPlanets.ts name (artwork + combat identity) */
  name: string
  classification: string
  rarity: CardRarity
  /** one-line flavor text */
  flavor: string
  facts: string[]
  /** label -> value, instrument-readout style */
  physical: Record<string, string>
  discovery?: string
}

function c(no: number, id: string, name: string, classification: string, rarity: CardRarity, flavor: string, facts: string[], physical: Record<string, string>, discovery?: string): CardDefinition {
  return { id, no, name, classification, rarity, flavor, facts, physical, discovery }
}

export const SET_1_NAME = 'THE SOLAR NEIGHBORHOOD'

export const CARD_CATALOG: CardDefinition[] = [
  // — Inner solar system —
  c(1, 'mercury', 'MERCURY', 'Terrestrial planet', 'rare', 'Closest to the Sun, and still not the hottest.', ['A year lasts 88 days, but sunrise to sunrise takes 176 days - longer than its year.', 'Its temperature swings from 430°C in sunlight to -180°C at night.'], { Radius: '2,440 km', 'Solar distance': '0.39 AU', Day: '176 Earth days' }),
  c(2, 'venus', 'VENUS', 'Terrestrial planet', 'rare', 'A runaway greenhouse wrapped in acid clouds.', ['Hottest planet in the solar system at ~465°C - hot enough to melt lead.', 'It spins backwards: on Venus, the Sun rises in the west.'], { Radius: '6,052 km', 'Surface pressure': '92 atm', Temperature: '465°C' }),
  c(3, 'earth', 'EARTH', 'Terrestrial planet', 'ultra', 'The only known world with life. Handle with care.', ['The only place in the universe where life is confirmed to exist.', '71% of its surface is ocean, yet all its water is just 0.02% of its mass.'], { Radius: '6,371 km', Age: '4.54 billion years', Life: 'Confirmed' }),
  c(4, 'luna', 'LUNA', 'Natural satellite', 'uncommon', "Earth's constant companion and first stepping stone.", ['The only world beyond Earth that humans have walked on - 12 people, 1969-1972.', 'It drifts away from Earth by about 3.8 cm every year.'], { Radius: '1,737 km', Distance: '384,400 km', 'Visited by': '12 humans' }),
  c(5, 'mars', 'MARS', 'Terrestrial planet', 'rare', 'The rusted world we may call home next.', ['Home to Olympus Mons, the tallest volcano known - nearly 3× the height of Everest.', 'Its red color is literally rust: iron oxide dust covers the planet.'], { Radius: '3,390 km', Day: '24.6 hours', 'Tallest volcano': '21.9 km' }),
  c(6, 'phobos', 'PHOBOS', 'Natural satellite', 'common', 'A doomed moon spiraling toward Mars.', ['Orbits Mars faster than Mars rotates - it rises in the west twice a day.', 'In ~50 million years it will crash into Mars or break into a ring.'], { Size: '27 × 22 × 18 km', Orbit: '7.7 hours', Fate: 'Falling' }),
  c(7, 'ceres', 'CERES', 'Dwarf planet', 'uncommon', 'The largest object in the asteroid belt.', ['The bright spots in Occator crater are salt left by briny water reaching the surface.', 'It holds about a third of the asteroid belt’s entire mass.'], { Radius: '473 km', Location: 'Asteroid belt', 'Water ice': 'Confirmed' }, 'Discovered by Giuseppe Piazzi, 1801'),
  c(8, 'vesta', 'VESTA', 'Asteroid', 'common', 'A protoplanet frozen mid-construction.', ['One of the brightest asteroids - occasionally visible to the naked eye.', 'A giant impact blasted off chunks that still land on Earth as meteorites.'], { Radius: '263 km', Location: 'Asteroid belt', Visited: 'Dawn, 2011' }),
  c(9, 'io', 'IO', 'Natural satellite', 'rare', 'The most volcanic body in the solar system.', ['Hundreds of active volcanoes, some with plumes 500 km high.', "Jupiter's tides knead its interior like dough, keeping it molten."], { Radius: '1,822 km', Volcanoes: '400+', Parent: 'Jupiter' }, 'Discovered by Galileo Galilei, 1610'),
  c(10, 'europa', 'EUROPA', 'Natural satellite', 'rare', 'An ocean world under a shell of ice.', ['Beneath its cracked ice lies a salty ocean with more water than all of Earth’s seas.', 'One of the most promising places to search for life beyond Earth.'], { Radius: '1,561 km', 'Ice shell': '15-25 km', Ocean: 'Subsurface' }, 'Discovered by Galileo Galilei, 1610'),
  c(11, 'ganymede', 'GANYMEDE', 'Natural satellite', 'uncommon', 'The largest moon in the solar system.', ['Bigger than the planet Mercury.', 'The only moon known to generate its own magnetic field.'], { Radius: '2,634 km', Parent: 'Jupiter', 'Magnetic field': 'Yes' }, 'Discovered by Galileo Galilei, 1610'),
  c(12, 'callisto', 'CALLISTO', 'Natural satellite', 'common', 'The most cratered world known.', ['Its surface is ancient - nearly unchanged for 4 billion years.', 'Considered a candidate site for future human bases: outside Jupiter’s worst radiation.'], { Radius: '2,410 km', Parent: 'Jupiter', Surface: '~4 Gyr old' }, 'Discovered by Galileo Galilei, 1610'),
  c(13, 'titan', 'TITAN', 'Natural satellite', 'rare', 'The moon with weather, rivers, and seas.', ['The only moon with a thick atmosphere - and the only other world with liquid on its surface.', 'Its rivers and seas are liquid methane at -179°C.'], { Radius: '2,575 km', Atmosphere: '1.45 atm', Seas: 'Methane' }, 'Discovered by Christiaan Huygens, 1655'),
  c(14, 'enceladus', 'ENCELADUS', 'Natural satellite', 'rare', 'A tiny moon venting its ocean into space.', ['Geysers at its south pole spray ocean water 100s of km into space.', 'That spray feeds one of Saturn’s rings.'], { Radius: '252 km', Parent: 'Saturn', Geysers: 'Active' }, 'Discovered by William Herschel, 1789'),
  c(15, 'mimas', 'MIMAS', 'Natural satellite', 'common', "That's no space station.", ['The crater Herschel spans a third of its diameter.', 'Recent orbit data suggests a young ocean may hide beneath its ice.'], { Radius: '198 km', Parent: 'Saturn', 'Big crater': '139 km' }),
  c(16, 'triton', 'TRITON', 'Natural satellite', 'uncommon', 'A captured world orbiting backwards.', ['Orbits Neptune opposite to its rotation - it was likely captured from the Kuiper belt.', 'Nitrogen geysers erupt from its -235°C surface.'], { Radius: '1,353 km', Orbit: 'Retrograde', Temperature: '-235°C' }, 'Discovered by William Lassell, 1846'),
  c(17, 'pluto', 'PLUTO', 'Dwarf planet', 'rare', 'The heart of the Kuiper belt.', ['Its heart-shaped nitrogen glacier, Sputnik Planitia, is larger than Texas.', 'Reclassified as a dwarf planet in 2006 - still beloved.'], { Radius: '1,188 km', 'Solar distance': '39 AU', Moons: '5' }, 'Discovered by Clyde Tombaugh, 1930'),
  c(18, 'charon', 'CHARON', 'Natural satellite', 'common', "Pluto's dance partner.", ['So large relative to Pluto that the pair orbit a point in open space between them.', 'Its north pole is stained red by material escaped from Pluto.'], { Radius: '606 km', Parent: 'Pluto', 'Size ratio': '1:2' }, 'Discovered by James Christy, 1978'),
  c(19, 'haumea', 'HAUMEA', 'Dwarf planet', 'uncommon', 'An egg-shaped world spinning too fast.', ['Spins so fast (4-hour day) that it stretched into an egg shape.', 'One of only two dwarf planets known to have rings.'], { 'Long axis': '~2,100 km', Day: '3.9 hours', Rings: 'Yes' }, 'Discovered 2004'),
  c(20, 'makemake', 'MAKEMAKE', 'Dwarf planet', 'common', 'A frozen world named for a creator god.', ['Named after the creator deity of Rapa Nui (Easter Island).', 'Its surface is coated in frozen methane and reddish organic compounds.'], { Radius: '715 km', 'Solar distance': '46 AU', Surface: 'Methane ice' }, 'Discovered 2005'),
  c(21, 'eris', 'ERIS', 'Dwarf planet', 'uncommon', 'The world that demoted Pluto.', ['Its discovery - more massive than Pluto - forced the definition of "planet" in 2006.', 'One of the most reflective bodies in the solar system.'], { Radius: '1,163 km', 'Solar distance': '68 AU', Albedo: '0.96' }, 'Discovered by Mike Brown’s team, 2005'),
  c(22, 'sedna', 'SEDNA', 'Trans-Neptunian object', 'uncommon', 'A wanderer from the deep dark.', ['One of the reddest objects known in the solar system.', 'Its orbit takes ~11,400 years - it may belong to the inner Oort cloud.'], { Radius: '~500 km', Orbit: '~11,400 years', Color: 'Deep red' }, 'Discovered 2003'),
  c(23, 'proxima-centauri-b', 'PROXIMA CENTAURI B', 'Exoplanet', 'rare', 'The nearest exoplanet to home.', ['Orbits the closest star to the Sun - 4.24 light-years away.', 'Sits in the habitable zone, though its star’s flares may strip its atmosphere.'], { Distance: '4.24 ly', 'Min. mass': '1.07 Earths', Year: '11.2 days' }, 'Discovered 2016'),
  c(24, 'trappist-1e', 'TRAPPIST-1E', 'Exoplanet', 'rare', 'One of seven worlds around a tiny star.', ['Part of a system of 7 Earth-sized planets around one red dwarf.', 'Considered one of the most potentially habitable exoplanets found.'], { Distance: '40 ly', Radius: '0.92 Earths', Year: '6.1 days' }, 'Discovered 2017'),
  c(25, 'kepler-452b', 'KEPLER-452B', 'Exoplanet', 'rare', "Earth's older cousin.", ['Orbits a Sun-like star at nearly the same distance Earth orbits ours.', 'Its star is 1.5 billion years older than the Sun - a preview of our future.'], { Distance: '~1,800 ly', Radius: '1.5 Earths', Year: '385 days' }, 'Discovered by Kepler, 2015'),
  c(26, 'kepler-186f', 'KEPLER-186F', 'Exoplanet', 'uncommon', 'A world of red-lit fields.', ['The first Earth-sized planet found in another star’s habitable zone.', 'Under its red dwarf sun, plant life (if any) might photosynthesize in the infrared.'], { Distance: '~580 ly', Radius: '1.17 Earths', Star: 'Red dwarf' }, 'Discovered by Kepler, 2014'),
  c(27, '55-cancri-e', '55 CANCRI E', 'Exoplanet', 'rare', 'A world with a lava ocean for a surface.', ['Its dayside is a global magma ocean at ~2,400°C.', 'A year there lasts 18 hours.'], { Distance: '41 ly', Radius: '1.9 Earths', Year: '17.7 hours' }, 'Discovered 2004'),
  c(28, 'corot-7b', 'COROT-7B', 'Exoplanet', 'common', 'Where it rains rock.', ['One of the first rocky exoplanets ever confirmed.', 'On its molten dayside, vaporized rock may condense and rain back down as pebbles.'], { Distance: '~490 ly', Radius: '1.6 Earths', Dayside: '~2,300°C' }, 'Discovered by CoRoT, 2009'),
  c(29, 'gj-1214-b', 'GJ 1214 B', 'Exoplanet', 'uncommon', 'A steam world with no shore.', ['Likely a "water world" with a deep, hot, steam-shrouded ocean.', 'Its haze was so thick it defied atmosphere studies for a decade.'], { Distance: '48 ly', Radius: '2.7 Earths', Type: 'Sub-Neptune' }, 'Discovered 2009'),
  c(30, 'k2-18-b', 'K2-18 B', 'Exoplanet', 'rare', 'A candidate ocean beneath a hydrogen sky.', ['JWST detected carbon-bearing molecules in its atmosphere in 2023.', 'A leading "hycean" candidate: a possible ocean world under hydrogen.'], { Distance: '124 ly', Radius: '2.6 Earths', Year: '33 days' }, 'Discovered by K2, 2015'),
  c(31, '16-psyche', '16 PSYCHE', 'Asteroid', 'uncommon', 'The exposed heart of a dead planet.', ['Likely the exposed metal core of a shattered protoplanet.', 'NASA’s Psyche spacecraft is on its way there now, arriving 2029.'], { Size: '~226 km', Composition: 'Metal-rich', Visitor: 'En route' }, 'Discovered 1852'),
  c(32, 'halleys-comet', "HALLEY'S COMET", 'Comet', 'rare', 'The once-in-a-lifetime visitor.', ['Returns every ~76 years; next apparition: 2061.', 'The first comet ever predicted to return - proving comets orbit the Sun.'], { Nucleus: '15 × 8 km', Period: '~76 years', 'Next visit': '2061' }, 'Return predicted by Edmond Halley, 1705'),
  c(33, '67p', '67P', 'Comet', 'common', 'The duck-shaped comet we landed on.', ['ESA’s Rosetta orbited it for 2 years; its lander Philae touched down in 2014.', 'Made of two lobes that gently merged long ago.'], { Size: '4.3 × 4.1 km', Shape: 'Two lobes', Visited: 'Rosetta, 2014' }),
  c(34, 'oumuamua', "'OUMUAMUA", 'Interstellar object', 'epic', 'The first visitor from another star.', ['The first object ever confirmed to come from outside the solar system.', 'It accelerated slightly as it left - likely outgassing, famously debated.'], { Length: '100-400 m', Origin: 'Interstellar', Speed: '87.3 km/s' }, 'Discovered by Pan-STARRS, 2017'),
  c(35, 'iapetus', 'IAPETUS', 'Natural satellite', 'common', 'The two-faced moon.', ['One hemisphere is coal-black, the other bright ice - a centuries-old mystery.', 'A ridge of 10 km peaks runs along its equator like a walnut seam.'], { Radius: '735 km', Parent: 'Saturn', 'Two tones': 'Yes' }, 'Discovered by Giovanni Cassini, 1671'),
  c(36, 'titania', 'TITANIA', 'Natural satellite', 'common', "Uranus's largest moon.", ['Named for the queen of the fairies in A Midsummer Night’s Dream.', 'Its canyons suggest the interior once expanded, cracking the crust.'], { Radius: '789 km', Parent: 'Uranus', Canyons: 'Yes' }, 'Discovered by William Herschel, 1787'),
  // — Giants —
  c(37, 'jupiter', 'JUPITER', 'Gas giant', 'epic', 'King of planets. Shield of the inner worlds.', ['More than twice as massive as all other planets combined.', 'The Great Red Spot is a storm larger than Earth, raging for centuries.'], { Radius: '69,911 km', Mass: '318 Earths', Moons: '95+' }),
  c(38, 'saturn', 'SATURN', 'Gas giant', 'epic', 'The jewel of the solar system.', ['Its rings are mostly water ice - vast, yet only ~10 meters to 1 km thick.', 'Less dense than water: it would float, given a big enough ocean.'], { Radius: '58,232 km', Rings: '~280,000 km wide', Density: '0.69 g/cm³' }),
  c(39, 'uranus', 'URANUS', 'Ice giant', 'epic', 'The planet that rolls on its side.', ['Tilted 98°: it orbits the Sun rolling like a barrel, with 42-year seasons.', 'The coldest planetary atmosphere in the solar system: -224°C.'], { Radius: '25,362 km', 'Axial tilt': '98°', Temperature: '-224°C' }, 'Discovered by William Herschel, 1781'),
  c(40, 'neptune', 'NEPTUNE', 'Ice giant', 'epic', 'Deep blue, and furious.', ['Home to the fastest winds measured on any planet: 2,100 km/h.', 'Found by mathematics before telescopes: its gravity betrayed it.'], { Radius: '24,622 km', Winds: '2,100 km/h', Year: '165 Earth years' }, 'Predicted by Le Verrier; observed 1846'),
  c(41, 'hd-189733-b', 'HD 189733 B', 'Hot Jupiter', 'epic', 'Azure skies. Glass rain. Sideways.', ['Its deep blue color likely comes from silicate clouds - glass rain in 8,700 km/h winds.', 'One of the most studied exoplanets ever.'], { Distance: '64 ly', Year: '2.2 days', Winds: '8,700 km/h' }, 'Discovered 2005'),
  c(42, 'wasp-12b', 'WASP-12B', 'Hot Jupiter', 'epic', 'A planet being eaten by its star.', ['So close to its star that it’s stretched egg-shaped and boiling away.', 'Pitch black: it absorbs ~94% of the light that hits it.'], { Distance: '~1,400 ly', Year: '26 hours', Albedo: '0.06' }, 'Discovered 2008'),
  c(43, '51-pegasi-b', '51 PEGASI B', 'Hot Jupiter', 'legendary', 'The discovery that started it all.', ['The first planet ever found orbiting a Sun-like star (1995).', 'Its discovery won the 2019 Nobel Prize in Physics.'], { Distance: '50 ly', Year: '4.2 days', Legacy: 'First of 5,000+' }, 'Discovered by Mayor & Queloz, 1995'),
  c(44, 'hd-209458-b', 'HD 209458 B', 'Hot Jupiter', 'epic', 'Osiris: the evaporating world.', ['The first exoplanet seen transiting its star, and the first with a detected atmosphere.', 'Its atmosphere streams away like a comet tail.'], { Distance: '159 ly', Year: '3.5 days', Status: 'Evaporating' }, 'Transit discovered 1999'),
  c(45, 'gj-504-b', 'GJ 504 B', 'Gas giant', 'epic', 'A young world glowing magenta.', ['Still hot from formation, it glows a dull magenta-pink.', 'One of the lowest-mass planets ever directly imaged.'], { Distance: '57 ly', Temperature: '~240°C', Imaged: 'Directly' }, 'Imaged by Subaru Telescope, 2013'),
  c(46, 'j1407-b', 'J1407 B', 'Ringed substellar object', 'legendary', 'The super Saturn.', ['Its ring system is ~200× larger than Saturn’s - 640× the Earth-Moon distance across.', 'If placed around Saturn, its rings would dominate our night sky.'], { Rings: '~180 million km', 'Ring mass': '~1 Earth', Type: 'Substellar' }, 'Rings inferred 2012'),
  // — Stars —
  c(47, 'the-sun', 'THE SUN', 'G-type main-sequence star', 'legendary', 'Our star. Every story starts here.', ['Contains 99.86% of the solar system’s mass.', 'Every second it fuses 600 million tons of hydrogen into helium.'], { Radius: '696,000 km', 'Core temp': '15 million °C', Age: '4.6 Gyr' }),
  c(48, 'proxima-centauri', 'PROXIMA CENTAURI', 'Red dwarf', 'epic', 'The Sun’s nearest neighbor.', ['The closest star to the Sun - 4.24 light-years.', 'A flare star: it can brighten dramatically within minutes.'], { Distance: '4.24 ly', Mass: '0.12 Suns', Planets: '2+' }, 'Discovered 1915'),
  c(49, 'sirius', 'SIRIUS', 'A-type star + white dwarf', 'epic', 'The brightest star in our night sky.', ['Actually two stars: brilliant Sirius A and a white dwarf companion, Sirius B.', 'Ancient Egypt timed the Nile flood by its dawn rising.'], { Distance: '8.6 ly', Luminosity: '25 Suns', Companion: 'White dwarf' }),
  c(50, 'vega', 'VEGA', 'A-type star', 'epic', 'The northern sky’s falling eagle.', ['Was the pole star 12,000 BC - and will be again around 13,700 AD.', 'The first star other than the Sun to be photographed (1850).'], { Distance: '25 ly', Luminosity: '40 Suns', Day: '12.5 hours' }),
  c(51, 'aldebaran', 'ALDEBARAN', 'Orange giant', 'epic', 'The eye of the bull.', ['A giant 44× the Sun’s diameter, glaring orange in Taurus.', 'Pioneer 10 is headed its way - arriving in ~2 million years.'], { Distance: '65 ly', Radius: '44 Suns', Constellation: 'Taurus' }),
  c(52, 'betelgeuse', 'BETELGEUSE', 'Red supergiant', 'legendary', 'A dying giant, due to blow.', ['If placed at the Sun’s position, it would swallow the orbits of Mercury through Mars, and likely Jupiter.', 'It will explode as a supernova - astronomically soon (within ~100,000 years).'], { Distance: '~550 ly', Radius: '~900 Suns', Fate: 'Supernova' }),
  c(53, 'rigel', 'RIGEL', 'Blue supergiant', 'epic', 'Orion’s blazing foot.', ['Shines with the light of ~120,000 Suns.', 'Though labeled Beta Orionis, it’s usually brighter than Alpha (Betelgeuse).'], { Distance: '~860 ly', Luminosity: '120,000 Suns', 'Surface temp': '12,000°C' }),
  c(54, 'antares', 'ANTARES', 'Red supergiant', 'epic', 'The rival of Mars.', ['Its name means "rival of Ares" - it matches Mars’s red glare.', 'Roughly 700× the Sun’s diameter; its outer layers are thinner than a candle flame.'], { Distance: '~550 ly', Radius: '~700 Suns', Constellation: 'Scorpius' }),
  c(55, 'uy-scuti', 'UY SCUTI', 'Red supergiant', 'legendary', 'One of the largest stars known.', ['If it replaced the Sun, its surface would reach past Jupiter.', 'Light takes ~7 hours to cross its diameter - the Sun’s takes 4.6 seconds.'], { Distance: '~5,900 ly', Radius: '~1,700 Suns', Type: 'Hypergiant' }),
  c(56, 'psr-b1919-21', 'PSR B1919+21', 'Pulsar', 'legendary', 'The signal they called LGM-1.', ['The first pulsar ever discovered - its precise pulses were jokingly labeled "Little Green Men".', 'A city-sized stellar corpse spinning with clock-beating regularity.'], { Period: '1.337 s', Size: '~20 km', Class: 'Neutron star' }, 'Discovered by Jocelyn Bell, 1967'),
  // — Nebulae —
  c(57, 'orion-nebula', 'ORION NEBULA', 'Emission nebula', 'legendary', 'A stellar nursery you can see by eye.', ['The nearest massive star-forming region - visible to the naked eye as Orion’s sword.', 'Over 1,000 infant stars are being born inside it right now.'], { Distance: '1,344 ly', Span: '~24 ly', 'Stars forming': '1,000+' }),
  c(58, 'crab-nebula', 'CRAB NEBULA', 'Supernova remnant', 'legendary', 'The wreckage of a star seen to die in 1054.', ['Chinese astronomers recorded its supernova in 1054 AD - visible in daylight for 23 days.', 'A pulsar at its heart spins 30 times per second.'], { Distance: '6,500 ly', Age: '~970 years', Heart: 'Pulsar' }, 'Supernova observed 1054 AD'),
  c(59, 'helix-nebula', 'HELIX NEBULA', 'Planetary nebula', 'epic', 'The eye of god.', ['The shed outer layers of a dying Sun-like star - our Sun’s eventual fate.', 'One of the closest planetary nebulae to Earth.'], { Distance: '~650 ly', Span: '~3 ly', 'Central star': 'White dwarf' }),
  c(60, 'eagle-nebula', 'EAGLE NEBULA', 'Emission nebula', 'epic', 'Home of the Pillars of Creation.', ['Hubble’s 1995 image of its pillars became one of astronomy’s most famous photographs.', 'The pillars are light-years tall and sculpted by newborn stars’ radiation.'], { Distance: '7,000 ly', Pillars: '~5 ly tall', Catalog: 'M16' }),
  c(61, 'cats-eye-nebula', "CAT'S EYE NEBULA", 'Planetary nebula', 'epic', 'A dying star’s intricate last art.', ['Among the most structurally complex nebulae known: shells, jets, and knots.', 'Its central star sheds a shell every ~1,500 years.'], { Distance: '~3,300 ly', Structure: '11+ shells', Catalog: 'NGC 6543' }),
  // — Galaxies —
  c(62, 'andromeda', 'ANDROMEDA', 'Spiral galaxy', 'legendary', 'A trillion stars. On approach.', ['The nearest major galaxy - and the farthest thing visible to the naked eye.', 'It will merge with the Milky Way in ~4.5 billion years.'], { Distance: '2.5 million ly', Stars: '~1 trillion', Collision: 'T-4.5 Gyr' }),
  c(63, 'whirlpool-galaxy', 'WHIRLPOOL GALAXY', 'Spiral galaxy', 'epic', 'The first spiral ever seen.', ['The first galaxy recognized to have spiral structure (1845).', 'A smaller companion galaxy tugs at its arm, driving star formation.'], { Distance: '31 million ly', Catalog: 'M51', Companion: 'NGC 5195' }, 'Spiral structure seen by Lord Rosse, 1845'),
  c(64, 'sombrero-galaxy', 'SOMBRERO GALAXY', 'Spiral galaxy', 'epic', 'A hat brim of a hundred billion suns.', ['Its dark dust lane and vast halo give it the look of a wide-brimmed hat.', 'Hosts a supermassive black hole of ~1 billion solar masses.'], { Distance: '29 million ly', Catalog: 'M104', 'Central BH': '~10⁹ Suns' }),
  // — Black holes —
  c(65, 'sagittarius-a-star', 'SAGITTARIUS A*', 'Supermassive black hole', 'ultra', 'The monster at the heart of our galaxy.', ['4 million solar masses at the center of the Milky Way.', 'Tracking stars orbiting it won the 2020 Nobel Prize in Physics; imaged by the EHT in 2022.'], { Mass: '4.15M Suns', Distance: '26,000 ly', Imaged: '2022' }),
  c(66, 'm87-star', 'M87*', 'Supermassive black hole', 'ultra', 'The first shadow humanity ever photographed.', ['The subject of the first-ever image of a black hole (Event Horizon Telescope, 2019).', 'Its jet of plasma extends 5,000 light-years into space.'], { Mass: '6.5B Suns', Distance: '55 million ly', Imaged: '2019' }),
]

const byName = new Map(CARD_CATALOG.map((card) => [card.name, card]))
const byId = new Map(CARD_CATALOG.map((card) => [card.id, card]))

export function cardByName(name: string): CardDefinition | undefined {
  return byName.get(name)
}
export function cardById(id: string): CardDefinition | undefined {
  return byId.get(id)
}

export const RARITY_ORDER: CardRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra']
export const RARITY_LABEL: Record<CardRarity, string> = {
  common: 'COMMON',
  uncommon: 'UNCOMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
  ultra: 'ULTRA RARE',
}
