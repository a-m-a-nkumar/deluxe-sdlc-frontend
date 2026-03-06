import { MainLayout } from "@/components/layout/MainLayout";
import { PairProgrammingDashboard } from "@/components/dashboard/PairProgrammingDashboard";
import { useNavigate } from "react-router-dom";

const PairProgramming = () => {
    const navigate = useNavigate();

    const handleBack = () => {
        navigate("/");
    };

    return (
        <div className="min-h-screen bg-background">
            <MainLayout currentView="pair-programming" showBackButton onBack={handleBack}>
                <PairProgrammingDashboard onBack={handleBack} />
            </MainLayout>
        </div>
    );
};

export default PairProgramming;
