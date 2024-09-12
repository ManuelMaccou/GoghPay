
import { useEffect, useState } from 'react';

const SquareCallback = () => {
  const [result, setResult] = useState<string>('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const transactionInfo: any = {};

    // Parse the parameters
    urlParams.forEach((value, key) => {
      transactionInfo[key] = value;
    });

    // Process the result
    if (transactionInfo["com.squareup.pos.ERROR_CODE"]) {
      setResult(`Error: ${transactionInfo["com.squareup.pos.ERROR_CODE"]}`);
    } else {
      let resultString = "";
      resultString += `Client Transaction ID: ${transactionInfo["com.squareup.pos.CLIENT_TRANSACTION_ID"] || 'NOT PROVIDED'}<br>`;
      resultString += `Transaction ID: ${transactionInfo["com.squareup.pos.SERVER_TRANSACTION_ID"] || 'NOT PROVIDED'}<br>`;
      setResult(resultString);
    }
  }, []);

  return (
    <div>
      <h1>Transaction Result</h1>
      <div dangerouslySetInnerHTML={{ __html: result }} />
    </div>
  );
};

export default SquareCallback;
