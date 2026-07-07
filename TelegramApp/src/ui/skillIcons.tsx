import type { ReactElement } from 'react'
import { SkillType } from '../game/config/SkillDefinition'
import { SkillOverdriveIcon, SkillMeteorIcon, SkillFleetSurgeIcon, SkillGoldenIcon, SkillDroneSwarmIcon } from './icons'

export const SKILL_ICONS: Record<SkillType, (props: { color: string; size?: number }) => ReactElement> = {
  [SkillType.Overdrive]: SkillOverdriveIcon,
  [SkillType.BattleCry]: SkillFleetSurgeIcon,
  [SkillType.MeteorStrike]: SkillMeteorIcon,
  [SkillType.MidasBeam]: SkillGoldenIcon,
  [SkillType.DroneSwarm]: SkillDroneSwarmIcon,
  [SkillType.TargetingSystem]: SkillOverdriveIcon,
}
