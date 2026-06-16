import React, { useState } from "react";
import Card from "@/components/ui/Card";
import Switch from "@/components/ui/Switch";
import { Collapse } from "react-collapse";
import SyntaxHighlighter from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import SimpleBar from "simplebar-react";

const codeSnippet = ({ children, title, code }) => {
  const [show, setShow] = useState(false);
  const toggle = () => {
    setShow(!show);
  };

  return (
    <Card title={title} headerslot={<Switch onChange={toggle} value={show} />}>
      {children}

      <div className={show ? "mt-6 " : ""}>
        <Collapse isOpened={show}>
          <SimpleBar className=" h-[350px] rounded-md ">
            <SyntaxHighlighter
              language="javascript"
              className=" rounded-md  text-sm    "
              style={atomOneDark}
              customStyle={{
                padding: "24px",
              }}
            >
              {code}
            </SyntaxHighlighter>
          </SimpleBar>
        </Collapse>
      </div>
    </Card>
  );
};

export default codeSnippet;
