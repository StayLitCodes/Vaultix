import ConfirmationSection from "@/component/escrow/confirmation/ConfirmationSection";
import Hero from "@/component/homepage/Hero";
import HowItWorks from "@/component/homepage/HowItWorks";
import Footer from "@/component/layout/Footer";
import Navbar from "@/component/layout/Navbar";
import Image from "next/image";

export default function Home() {
  return (
    <div>
      <Navbar/>
      {/* <Hero/>
      <HowItWorks/> */}
      <ConfirmationSection/>
      <Footer/>
    </div>
  );
}
