export const basicBadge = `
import Badge from "@/components/ui/Badge"
const BasicBadge = () => {
  return (
    <>
    <Badge label="primary" className="bg-indigo-500 text-white" />
    <Badge label="secondary" className="bg-fuchsia-500 text-white" />
    <Badge label="danger" className="bg-red-500 text-white" />
    <Badge label="success" className="bg-green-500 text-white" />
    <Badge label="info" className="bg-cyan-500 text-white" />
    <Badge label="warning" className="bg-yellow-500 text-white" />
    <Badge label="Dark" className="bg-gray-800 dark:bg-gray-900  text-white"/>
    <Badge label="light" className="bg-gray-200 text-gray-700" />
    </>
  )
}
export default BasicBadge
`;

export const roundedBadge = `import Badge from "@/components/ui/Badge"
const RoundedBadge = () => {
  return (
    <> 
    <Badge label="primary" className="bg-indigo-500 text-white pill" />
    <Badge label="secondary" className="bg-fuchsia-500 text-white pill" />
    <Badge label="danger" className="bg-red-500 text-white pill" />
    <Badge label="success" className="bg-green-500 text-white pill" />
    <Badge label="info" className="bg-cyan-500 text-white pill" />
    <Badge label="warning" className="bg-yellow-500 text-white pill" />
    <Badge label="Dark" className="bg-gray-800 dark:bg-gray-900 text-white pill" />
    </>
  )
}
export default RoundedBadge
`;

export const glowBadge = `
import Badge from "@/components/ui/Badge"
const GlowBadge = () => {
  return (
    <>
      <Badge label="primary" className="bg-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/50"/>
      <Badge label="secondary" className="bg-fuchsia-500 text-white hover:shadow-lg hover:shadow-fuchsia-500/50"/>
      <Badge label="success" className=" bg-green-500 text-white hover:shadow-lg hover:shadow-green-500/50"/>
      <Badge label="info" className=" bg-cyan-500 text-white hover:shadow-lg hover:shadow-cyan-500/50"/>
      <Badge label="warning" className=" bg-yellow-500 text-white hover:shadow-lg hover:shadow-yellow-500/50"/>
      <Badge label="error" className=" bg-red-500 text-white hover:shadow-lg hover:shadow-red-500/50"/>
      <Badge label="Dark" className="bg-gray-800 text-white hover:shadow-lg hover:shadow-gray-800/20"/>
      <Badge label="Light" className=" bg-gray-200 text-gray-700 hover:shadow-lg hover:shadow-gray-400/30"/>
    </>
  )
}
export default GlowBadge
`;

export const softColorBadge = `
import Badge from "@/components/ui/Badge"
const SoftColorBadge = () => {
  return (
    <>
      <Badge label="primary" className="bg-indigo-500 text-indigo-700 bg-opacity-10"/>
      <Badge label="secondary" className="bg-fuchsia-500 text-fuchsia-500 bg-opacity-10"/>
      <Badge label="danger" className="bg-red-500 text-red-600 bg-opacity-10"/>
      <Badge label="success" className="bg-green-500 text-green-600 bg-opacity-10"/>
      <Badge label="info" className="bg-cyan-500 text-cyan-600 bg-opacity-10"/>
      <Badge label="warning" className="bg-yellow-500 text-yellow-400 bg-opacity-10"/>
    </>
  )
}
export default SoftColorBadge
`;

export const outlineBadge = `
import Badge from "@/components/ui/Badge"
const OutlineBadge = () => {
  return (
    <>
       <Badge label="primary" className="bg-indigo-500 text-indigo-700 bg-opacity-10"/>
       <Badge label="secondary" className="bg-fuchsia-500 text-fuchsia-500 bg-opacity-10"/>
       <Badge label="danger" className="bg-red-500 text-red-600 bg-opacity-10"/>
       <Badge label="success" className="bg-green-500 text-green-600 bg-opacity-10"/>
       <Badge label="info" className="bg-cyan-500 text-cyan-600 bg-opacity-10"/>
       <Badge label="warning" className="bg-yellow-500 text-yellow-400 bg-opacity-10"/>
    </>
  )
}
export default OutlineBadge
`;

export const badgeWithIcon = `
import Badge from "@/components/ui/Badge"
const BadgeWithIcon = () => {
  return (
    <>
        <Badge label="primary" className="bg-indigo-500 text-indigo-700 bg-opacity-10"/>
        <Badge label="secondary" className="bg-fuchsia-500 text-fuchsia-500 bg-opacity-10"/>
        <Badge label="danger" className="bg-red-500 text-red-600 bg-opacity-10"/>
        <Badge label="success" className="bg-green-500 text-green-600 bg-opacity-10"/>
        <Badge label="info" className="bg-cyan-500 text-cyan-600 bg-opacity-10"/>
        <Badge label="warning" className="bg-yellow-500 text-yellow-400 bg-opacity-10"/>
    </>
  )
}
export default BadgeWithIcon
`;
