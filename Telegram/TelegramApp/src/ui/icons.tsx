// Inline SVG icons, paths copied from the Claude Design "Stellar Breaker" system
// (GamePhone.dc.html) so they tint via `color`/`fill`/`stroke` props exactly like the source,
// rather than needing image-tinting tricks on a flat PNG.
interface IconProps {
  color?: string
  size?: number
}

export function SettingsIcon({ color = '#C7CCDC', size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 8a4 4 0 100 8 4 4 0 000-8z" stroke={color} strokeWidth="1.8" />
      <path
        d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ProfileIcon({ color = '#C7CCDC', size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8.5" r="3.5" stroke={color} strokeWidth="1.8" />
      <path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function MissionsBellIcon({ color = '#C7CCDC', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 10a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 19a2 2 0 004 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function DailyGiftIcon({ color = '#C7CCDC', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="10" width="16" height="10" rx="1.5" stroke={color} strokeWidth="1.8" />
      <path
        d="M4 10h16M12 10v10M12 10c-2-3-6-4-6-1s4 1 6 1zm0 0c2-3 6-4 6-1s-4 1-6 1z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CloseIcon({ color = '#8B93AC', size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13">
      <path d="M1 1l11 11M12 1L1 12" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function LockIcon({ color = '#5C6480', size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="10" rx="2" fill={color} />
      <path d="M8 11V8a4 4 0 018 0v3" stroke={color} strokeWidth="2" fill="none" />
    </svg>
  )
}

export function CheckIcon({ color = '#3ADC84', size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M4 12l6 6L20 6" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function GoldIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" fill="#FFB238" />
      <circle cx="12" cy="12" r="10" fill="none" stroke="#E8930F" strokeWidth="1.6" />
      <rect x="9" y="9" width="6" height="6" fill="#E8930F" transform="rotate(45 12 12)" />
    </svg>
  )
}

export function FleetDpsIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2l7 16-7-4-7 4z" fill="#43DDEE" />
    </svg>
  )
}

export function RelicIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M12 2l7 6-3 14H8L5 8z" fill="#E24FFF" opacity="0.9" />
      <path d="M12 2l7 6H5z" fill="#F49CFF" />
    </svg>
  )
}

// -- Nav icons --
export function NavCombatIcon({ color, size = 21 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="7" stroke={color} strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2" fill={color} />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function NavFleetIcon({ color, size = 21 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2l7 16-7-4-7 4z" fill={color} />
    </svg>
  )
}

export function NavArtifactsIcon({ color, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3l6 5-6 13-6-13z" fill={color} />
    </svg>
  )
}

export function NavPrestigeIcon({ color, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2c0 4 2 8 6 9-4 1-6 5-6 9 0-4-2-8-6-9 4-1 6-5 6-9z" fill={color} />
    </svg>
  )
}

export function NavCardsIcon({ color, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="13" height="17" rx="2" transform="rotate(-8 3 5)" stroke={color} strokeWidth="1.8" />
      <rect x="8" y="4" width="13" height="17" rx="2" fill={color} opacity="0.15" stroke={color} strokeWidth="1.8" />
    </svg>
  )
}

// -- Skill glyphs (Overdrive, Meteor, FleetSurge/BattleCry, Golden/Midas, DroneSwarm) --
export function SkillOverdriveIcon({ color, size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill={color} />
    </svg>
  )
}

export function SkillMeteorIcon({ color, size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 19L19 5M19 5h-6M19 5v6" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="2.4" fill={color} />
    </svg>
  )
}

export function SkillFleetSurgeIcon({ color, size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 4l7 6.5-7 6.5-7-6.5z" stroke={color} strokeWidth="2" />
      <path d="M5 18l7 3 7-3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function SkillGoldenIcon({ color, size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="7" fill={color} />
      <path d="M12 5v14M12 5l-3 3M12 5l3 3" stroke="#141A2C" strokeWidth="1.3" fill="none" />
    </svg>
  )
}

/** Stand-in for the design's "Second Wind" slot - our real 5th skill is Drone Swarm. */
export function SkillDroneSwarmIcon({ color, size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="7" cy="8" r="2.4" stroke={color} strokeWidth="1.8" />
      <circle cx="17" cy="8" r="2.4" stroke={color} strokeWidth="1.8" />
      <circle cx="12" cy="17" r="2.4" stroke={color} strokeWidth="1.8" />
      <path d="M8.8 9.6L11 15M15.2 9.6L13 15M9.4 8h5.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// -- Artifact glyphs --
export function ArtifactHeliosIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" fill="#FFB238" />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M4.5 19.5l2-2M17.5 6.5l2-2"
        stroke="#FFB238"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ArtifactGravityIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="9" r="5" stroke="#43DDEE" strokeWidth="2" />
      <path d="M12 14v7M8 21h8" stroke="#43DDEE" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function ArtifactStarChartIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M12 2l2.5 7.2L22 12l-7.5 2.8L12 22l-2.5-7.2L2 12l7.5-2.8z" fill="#FFD873" />
    </svg>
  )
}

export function ArtifactPhoenixIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path
        d="M12 2c2 3-1 4-1 7 0 2 1 3 3 3-1-3 2-4 2-7 3 3 4 8 1 12-3 3-8 3-11 0-3-4-1-9 3-12 0 2-1 4 1 6 0-3 1-6 2-9z"
        fill="#B07CFF"
      />
    </svg>
  )
}

export function ArtifactVoidglassIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" stroke="#FF6FB8" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" fill="#FF6FB8" />
    </svg>
  )
}

export function ArtifactBeaconIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M9 21l1-9h4l1 9z" fill="#E24FFF" />
      <path d="M12 3l5 8H7z" fill="#F49CFF" />
    </svg>
  )
}
