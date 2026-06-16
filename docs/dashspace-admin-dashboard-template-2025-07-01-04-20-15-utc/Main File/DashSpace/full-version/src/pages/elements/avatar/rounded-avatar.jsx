import Avatar from "@/components/ui/Avatar"

import User1 from "@/assets/images/avatar/avatar.jpg"
import User2 from "@/assets/images/avatar/avatar-1.jpg"
import User3 from "@/assets/images/avatar/avatar-2.jpg"
import User4 from "@/assets/images/avatar/avatar-3.jpg"
import User5 from "@/assets/images/avatar/avatar-4.jpg"
import User6 from "@/assets/images/avatar/avatar-5.jpg"

const RoundedAvatar = () => {
    return (
        <div className=" max-w-2xl   space-xy">
            <Avatar src={User1} alt="avatar-one" />
            <Avatar src={User2} alt="avatar-one" className="w-10 h-10" />
            <Avatar src={User3} alt="avatar-one" className="w-12 h-12" />
            <Avatar src={User4} alt="avatar-one" className="w-16 h-16" />
            <Avatar src={User5} alt="avatar-one" className="w-20 h-20" />
            <Avatar src={User6} alt="avatar-one" className="w-24 h-24" />
        </div>
    );
};

export default RoundedAvatar;