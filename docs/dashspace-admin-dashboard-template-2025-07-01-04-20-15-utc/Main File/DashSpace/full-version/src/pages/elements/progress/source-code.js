export const basicProgressBar = `import ProgressBar from "@/components/ui/ProgressBar"
const basicProgressBar = () => {
  return (
    <> 
     <ProgressBar value={30} className="bg-indigo-500" />
     <ProgressBar value={50} className=" bg-fuchsia-500" />
     <ProgressBar value={70} className=" bg-green-500" />
     <ProgressBar value={80} className=" bg-cyan-500" />
     <ProgressBar value={90} className="bg-yellow-500" />
     <ProgressBar value={95} className=" bg-red-500" />
    </>
  )
}
export default basicProgressBar
`;

export const softColorProgressBar = `
import ProgressBar from "@/components/ui/ProgressBar"
const SoftColorProgressBar = () => {
  return (
    <>  
      <ProgressBar value={30} className="bg-indigo-500" backClass="bg-indigo-500/25"/>
      <ProgressBar value={50} className=" bg-fuchsia-500" backClass="bg-fuchsia-500/25"/>
      <ProgressBar value={70} className=" bg-green-500" backClass="bg-green-500/25"/>
      <ProgressBar value={80} className=" bg-cyan-500" backClass="bg-cyan-500/25"/>
      <ProgressBar value={90} className="bg-yellow-500" backClass="bg-yellow-500/25"/>
      <ProgressBar value={95} className=" bg-red-500" backClass="bg-red-500/25"/>
    </>
  )
}
export default SoftColorProgressBar
`;

export const progressSize = `
import ProgressBar from "@/components/ui/ProgressBar"
const ProgressSize = () => {
  return (
   <>
     <ProgressBar value={30} />
     <ProgressBar value={50} backClass="h-[10px] rounded-full" className="bg-indigo-500"/>
     <ProgressBar value={80} backClass="h-[14px] rounded-full" className="bg-red-500"/>
     <ProgressBar value={70} backClass="h-4 rounded-full" className="bg-yellow-500"/>
    </>
  )
}
export default ProgressSize
`;

export const progressStripped = `
import ProgressBar from "@/components/ui/ProgressBar"
const ProgressStripped = () => {
  return (
    <>  
      <ProgressBar value={30} className="bg-gray-900 " striped backClass="h-3 rounded-full"/>
      <ProgressBar value={30} className="bg-indigo-500 " striped backClass="h-3 rounded-full"/>
      <ProgressBar value={80} className="bg-red-500 " striped backClass="h-3 rounded-full"/>
      <ProgressBar value={50} className="bg-yellow-500  " striped backClass="h-3 rounded-full"/>
      <ProgressBar value={70} className=" bg-cyan-500 " striped backClass="h-3 rounded-full"/>  
    </>
  )
}
export default ProgressStripped
`;

export const activeProgress = `
import ProgressBar from "@/components/ui/ProgressBar"
const ActiveProgress = () => {
  return (
    <>
     <ProgressBar value={30} className="bg-indigo-500" active />
     <ProgressBar value={50} className=" bg-fuchsia-500" active />
     <ProgressBar value={70} className=" bg-green-500" active />
     <ProgressBar value={80} className=" bg-cyan-500" active />
     <ProgressBar value={90} className="bg-yellow-500" active />
     <ProgressBar value={95} className=" bg-red-500" active />  
    </>
  )
}
export default ActiveProgress
`;

export const animatedStripped = `
import ProgressBar from "@/components/ui/ProgressBar"
const AnimatedStripped = () => {
  return (
    <>
      <ProgressBar value={30} className="bg-gray-900 " striped backClass="h-3 rounded-full" animate/>
      <ProgressBar value={60} className="bg-indigo-500 " striped backClass="h-3 rounded-full" animate/>
      <ProgressBar value={40} className="bg-red-500 " striped backClass="h-3 rounded-full" animate/>
      <ProgressBar value={50} className="bg-yellow-500  " striped backClass="h-3 rounded-full" animate/>
      <ProgressBar value={70} className=" bg-cyan-500 " striped backClass="h-3 rounded-full" animate/>
    </>
  )
}
export default AnimatedStripped
`;

export const progressValue = `
import ProgressBar from "@/components/ui/ProgressBar"
const ProgressValue = () => {
  return (
    <>
      <ProgressBar value={30} className="bg-gray-900 " striped backClass="h-3 rounded-full" animate/>
      <ProgressBar value={60} className="bg-indigo-500 " striped backClass="h-3 rounded-full" animate/>
      <ProgressBar value={40} className="bg-red-500 " striped backClass="h-3 rounded-full" animate/>
      <ProgressBar value={50} className="bg-yellow-500  " striped backClass="h-3 rounded-full" animate/>
      <ProgressBar value={70} className=" bg-cyan-500 " striped backClass="h-3 rounded-full" animate/>
    </>
  )
}
export default ProgressValue
`;

export const multipleBarProgressBar = `
import ProgressBar from "@/components/ui/ProgressBar"
import Bar from "@/components/ui/ProgressBar/Bar";
const MultipleBarProgressBar = () => {
  return (
    <>
    <ProgressBar backClass="h-3 rounded-full">
    <Bar value={10} className="bg-indigo-500" />
    <Bar value={15} className=" bg-yellow-500" />
    <Bar value={20} className=" bg-red-500" />
    <Bar value={20} className="bg-cyan-500" />
    </ProgressBar>
    <ProgressBar backClass="h-3 rounded-full">
    <Bar value={10} className="bg-indigo-500" showValue />
    <Bar value={15} className=" bg-yellow-500" showValue />
    <Bar value={20} className=" bg-red-500" showValue />
    <Bar value={20} className="bg-cyan-500" showValue />
    </ProgressBar>
    </>
  )
}
export default MultipleBarProgressBar
`;
