import { usePrivy } from "@privy-io/react-auth";

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function MyRewards({ params }: { params: { merchantId: string } }) {  
  const { ready, authenticated, user } = usePrivy();
  

  return (

  )
}