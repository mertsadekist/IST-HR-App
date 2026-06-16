import ProgressBar from "@/components/ui/ProgressBar";

const SoftColorProgressBar = () => {
  return (
    <div className="space-y-4  xl:w-[70%]">
      <ProgressBar
        value={30}
        className="bg-indigo-500"
        backClass="bg-indigo-500/25"
      />
      <ProgressBar
        value={50}
        className=" bg-fuchsia-500"
        backClass="bg-fuchsia-500/25"
      />
      <ProgressBar
        value={70}
        className=" bg-green-500"
        backClass="bg-green-500/25"
      />
      <ProgressBar
        value={80}
        className=" bg-cyan-500"
        backClass="bg-cyan-500/25"
      />
      <ProgressBar
        value={90}
        className="bg-yellow-500"
        backClass="bg-yellow-500/25"
      />
      <ProgressBar
        value={95}
        className=" bg-red-500"
        backClass="bg-red-500/25"
      />
    </div>
  );
};

export default SoftColorProgressBar;
