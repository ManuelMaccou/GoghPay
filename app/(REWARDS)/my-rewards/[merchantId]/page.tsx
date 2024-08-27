import { usePrivy } from "@privy-io/react-auth";
import { Text } from "@radix-ui/themes";

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function MyRewards({ params }: { params: { merchantId: string } }) {  
  const { ready, authenticated, user } = usePrivy();
  

  return (
<Text>Placeholder</Text>
  )
}