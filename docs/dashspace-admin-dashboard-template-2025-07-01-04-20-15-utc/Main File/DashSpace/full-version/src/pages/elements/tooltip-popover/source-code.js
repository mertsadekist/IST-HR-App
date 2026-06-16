export const basicTooltip = `
import Tooltip from "@/components/ui/Tooltip"
const BasicTooltip = () => {
  return (
    <>
     <Tooltip title="primary"
      content="primary style"
       placement="top"
       className="btn btn-primary "
      arrow theme="primary"/>
     <Tooltip title="secondary"
      content="secondary style"
      placement="top" 
    className="btn btn-secondary "
       arrow theme="secondary"/>
     <Tooltip title="success" content="success style" placement="top" className="btn btn-success" arrow theme="success"/>
     <Tooltip title="info" content="info style" placement="top" className="btn btn-info " arrow theme="info"/>
     <Tooltip title="warning" content="warning style" placement="top" className="btn btn-warning " arrow theme="warning"/>
     <Tooltip title="danger" content="danger style" placement="top" className="btn btn-danger " arrow theme="danger"/>
     <Tooltip title="dark" content="Dark style" placement="top" className="btn btn-dark " arrow theme="dark"/>
     <Tooltip title="light" content="Light style" placement="top" className="btn btn-light " arrow theme="light"/>
  </>
  )
}
export default BasicTooltip
`;

export const positionsTooltip = `
import Tooltip from "@/components/ui/Tooltip"
const PositionsTooltip = () => {
  return (
    <>
    <Tooltip title="top" content="Top" placement="top" className="btn btn-primary light" theme="primary" arrow/>
    <Tooltip title="Top Start" content="Top Start" placement="top-start" arrow className="btn btn-secondary light" theme="secondary"/>
    <Tooltip title="Top End" content="Top End" placement="top-end" arrow className="btn btn-success light" theme="success"/>
    <Tooltip title="Right" content="Right" placement="right" arrow className="btn btn-info light" theme="info"/>
    <Tooltip title="Right Start" content="Right Start" placement="right-start" arrow className="btn btn-warning light" theme="warning"/>
    <Tooltip title="Right End" content="Right End" placement="right-end" arrow className="btn btn-danger light" theme="danger"/>
    <Tooltip title="Left" content="Left" placement="left" arrow className="btn btn-primary light" theme="primary"/>
    <Tooltip title="Left Start" content="Left Start" placement="left-start" arrow className="btn btn-secondary light" theme="secondary"/>
    <Tooltip title="Left End" content="Left End" placement="left-end" arrow className="btn btn-success light" theme="success"/>
    <Tooltip title="Bottom" content="Bottom" placement="bottom" arrow className="btn btn-info light" theme="info"/>
    <Tooltip title="Bottom Start" content="Bottom Start" placement="bottom-start" arrow className="btn btn-warning light" theme="warning"/>
    <Tooltip title="Bottom End" content="Bottom End" placement="bottom-end" arrow className="btn btn-danger light" theme="danger"/>
    </>
  )
}
export default PositionsTooltip
`;

export const animatedTooltip = `
import Tooltip from "@/components/ui/Tooltip"
const AnimatedTooltip = () => {
  return (
    <>
    <Tooltip title="Shift-away" content="Shift-away" placement="top" arrow animation="shift-away" className="btn btn-outline-primary" theme="primary"/>
    <Tooltip title="Shift-toward" content="Shift-toward" placement="top" arrow animation="shift-toward" className="btn btn-outline-secondary" theme="secondary"/>
    <Tooltip title="Scale" content="Scale" placement="top" arrow animation="scale" className="btn btn-outline-success" theme="success"/>
    <Tooltip title="Fade" content="Fade" placement="top" arrow animation="fade" className="btn btn-outline-info" theme="info"/>
    <Tooltip title="Perspective" content="Perspective" placement="top" arrow animation="Perspective" className="btn btn-outline-warning" theme="warning"/>
    </>
  )
}
export default AnimatedTooltip
`;
export const triggerTooltip = `
import Tooltip from "@/components/ui/Tooltip"
const TriggerTooltip = () => {
  return (
    <>
       <Tooltip title="Mouseenter" content="Mouseenter" placement="top" arrow trigger="mouseenter" className="btn btn-outline-primary" theme="primary"/>
        <Tooltip title="Click" content="Click" placement="top" arrow trigger="click" className="btn btn-outline-secondary" theme="secondary"/>
    </>
  )
}
export default TriggerTooltip
`;

export const interactiveTooltip = `
import Tooltip from "@/components/ui/Tooltip"
const InteractiveTooltip = () => {
  return (
    <>
      <Tooltip title="Interactive" content="Interactive tooltip" placement="top" arrow interactive className="btn btn-outline-primary" theme="primary"/>
    </>
  )
}
export default InteractiveTooltip
`;
export const htmlContentTooltip = `
import Tooltip from "@/components/ui/Tooltip"
const HTMLContentTooltip = () => {
  return (
    <>
    <Tooltip
        title="Html Content"
        placement="top"
        arrow
        allowHTML
        interactive
        theme="dark"
        maxWidth="320px"
        content={
                <div className="flex items-center -[-9px] text-gray-100">
                    <div className="flex-none ltr:mr-[10px] rtl:ml-[10px]">
                        <div className="h-[46px] w-[46px] rounded-full">
                             <img src={UserAvatar} alt="" className="block w-full h-full object-cover rounded-full"/>
                         </div>
                        </div>
                        <div className="flex-1  text-sm font-semibold  ">
                            <span className=" truncate w-full block">Faruk Ahamed</span>
                            <span className="block font-light text-xs   capitalize">
                                supper admin
                            </span>
                        </div>
                    </div>
                }
                className="btn btn-light">
        </Tooltip>
    </>
  )
}
export default HTMLContentTooltip
`;
