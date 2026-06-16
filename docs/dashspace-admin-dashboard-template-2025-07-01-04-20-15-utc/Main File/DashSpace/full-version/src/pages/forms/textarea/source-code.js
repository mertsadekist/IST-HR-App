export const basicTextarea =`
import Textarea from "@/components/ui/Textarea";
const BasicTextarea = () => {
    return (
        <Textarea placeholder="Type here.." />
    );
};
export default BasicTextarea;
`

export const displayRows = `
import Textarea from "@/components/ui/Textarea";
const DisplayRows = () => {
    return (
        <Textarea placeholder="Type here.." row="6" />
    );
};
export default DisplayRows;
`
export const validateTextarea = `
import Textarea from "@/components/ui/Textarea";
const ValidateTextarea = () => {
    const errorMessage = {
        message: "This is invalid",
    };
    return (
        <div className=" space-y-3">
            <Textarea
                id="ValidState"
                placeholder="Type here.."
                validate="This is valid ."
            />
            <Textarea
                id="InvalidState"
                placeholder="Type here.."
                error={errorMessage}
            />
        </div>
    );
};
export default ValidateTextarea;
`