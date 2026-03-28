import React, { useMemo } from 'react';

const TeamPoolTab = ({ teamPool = [] }) => {
  const conferences = useMemo(() => {
    const grouped = teamPool.reduce((acc, team) => {
      const conferenceKey = team.conference || 'Independent';
      if (!acc[conferenceKey]) acc[conferenceKey] = [];
      acc[conferenceKey].push(team);
      return acc;
    }, {});

    return Object.entries(grouped).map(([conference, teams]) => ({
      conference,
      divisions: teams.reduce((acc, team) => {
        const divisionKey = team.division || 'Division';
        if (!acc[divisionKey]) acc[divisionKey] = [];
        acc[divisionKey].push(team);
        return acc;
      }, {})
    }));
  }, [teamPool]);

  if (!teamPool.length) {
    return (
      <div className="rounded-lg bg-white shadow-md p-6 text-center border border-dashed border-gray-200">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Teams Configured</h3>
        <p className="text-sm text-gray-500">
          Once the league admin selects a team pool, the available teams will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {conferences.map(({ conference, divisions }) => (
        <section key={conference} className="rounded-lg bg-white shadow-md border border-gray-100">
          <header className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800">
              {conference}
            </h3>
          </header>
          <div className="px-6 py-4 space-y-6">
            {Object.entries(divisions).map(([division, teams]) => (
              <div key={`${conference}-${division}`}>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {division}
                </h4>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {teams.map(team => (
                    <div
                      key={team.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-indigo-200 transition shadow-sm bg-gray-50 flex items-center gap-3"
                    >
                      {team.logo && (
                        <img
                          src={team.logo}
                          alt={`${team.name} logo`}
                          className="h-10 w-10 rounded-full border border-gray-200 bg-white object-contain"
                        />
                      )}
                      <div>
                        <p className="text-gray-900 font-semibold">
                          {team.city} {team.name}
                        </p>
                        <p className="text-xs text-gray-500 uppercase mt-1">
                          {team.shortName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default TeamPoolTab;
