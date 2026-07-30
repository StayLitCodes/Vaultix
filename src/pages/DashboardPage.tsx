import React from 'react';
import { PendingInvitationsWidget } from '../components/dashboard/PendingInvitationsWidget';

export const DashboardPage: React.FC = () => {
  return (
    <div className="dashboard-container">
      <h1>User Dashboard</h1>

      {/* Pending Invitations Section */}
      <PendingInvitationsWidget />

      {/* Main Dashboard Content */}
      <section className="dashboard-main">
        <h2>Your Escrows</h2>
        {/* Active escrow lists... */}
      </section>
    </div>
  );
};
