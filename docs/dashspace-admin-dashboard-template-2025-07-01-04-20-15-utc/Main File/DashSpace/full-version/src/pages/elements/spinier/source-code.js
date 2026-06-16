export const basicSpinner = `
const BasicSpinner = () => {
  return (
    <>
    <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-indigo-500 border-r-transparent"></div>
    <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px]  border-fuchsia-500 border-r-transparent"></div>
    <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-cyan-500 border-r-transparent"></div>
    <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-green-500 border-r-transparent"></div>
    <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-yellow-500 border-r-transparent"></div>
    <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-red-500 border-r-transparent"></div>
    <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-gray-500 border-r-transparent dark:border-indigo-300 dark:border-r-transparent"></div>
    </>
  )
}
export default BasicSpinner
`;

export const softColorSpinner = `
const SoftColorSpinner = () => {
  return (
    <>
    <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-indigo-500/30 border-r-indigo-500"></div>
    <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px]  border-fuchsia-500/30 border-r-fuchsia-500"></div>
    <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-cyan-500/30 border-r-cyan-500"></div>
    <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-green-50/30 border-r-green-500"></div>
    <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-yellow-500/30 border-r-yellow-500"></div>
    <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-red-500/30 border-r-red-500"></div>
    <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-gray-500/30 border-r-gray-500 dark:border-r-gray-700"></div>
    </>
  )
}
export default SoftColorSpinner
`;
export const pingSpinner = `
const PingSpinner = () => {
  return (
    <>
    <span className="relative flex h-5 w-5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-full w-full bg-indigo-500"></span>
    </span>
    <span className="relative flex h-5 w-5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-500 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-full w-full bg-fuchsia-500"></span>
    </span>
    <span className="relative flex h-5 w-5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-500 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-full w-full bg-cyan-500"></span>
    </span>
    <span className="relative flex h-5 w-5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-full w-full bg-green-500"></span>
    </span>
    <span className="relative flex h-5 w-5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-full w-full bg-yellow-500"></span>
    </span>
    <span className="relative flex h-5 w-5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-full w-full bg-red-500"></span>
    </span>
    <span className="relative flex h-5 w-5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-500 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-full w-full bg-gray-500"></span>
    </span>
    </>
  )
}
export default PingSpinner
`;
