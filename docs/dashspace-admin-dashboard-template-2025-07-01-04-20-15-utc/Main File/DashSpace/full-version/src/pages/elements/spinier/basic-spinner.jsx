const BasicSpinner = () => {
  return (
    <div className="space-xy flex  flex-wrap">
      <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-indigo-500 border-r-transparent"></div>
      <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px]  border-fuchsia-500 border-r-transparent"></div>
      <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-cyan-500 border-r-transparent"></div>
      <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-green-500 border-r-transparent"></div>
      <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-yellow-500 border-r-transparent"></div>
      <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-red-500 border-r-transparent"></div>
      <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-gray-500 border-r-transparent dark:border-indigo-300 dark:border-r-transparent"></div>
    </div>
  );
};

export default BasicSpinner;
