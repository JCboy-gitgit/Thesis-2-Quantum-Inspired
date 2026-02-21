import re

path = 'c:/AntiGravity_Repo/Thesis-2-Quantum-Inspired/my-app/app/LandingPages/LiveTimetable/page.tsx'

with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the Admin Create Makeup Modal
text = text.replace(
'''                </div>
                </div>
    )
}

{/* ── Admin Create Makeup Modal ── */ }
{
    creatingMakeup && (''',
'''                </div>
            )}

            {/* ── Admin Create Makeup Modal ── */}
            {creatingMakeup && ('''
)

# Fix Makeup Review Modal
text = text.replace(
'''        </div>
    )
}

{/* ── Makeup Review Modal ── */ }
{
    reviewingMakeup && (''',
'''                </div>
            )}

            {/* ── Makeup Review Modal ── */}
            {reviewingMakeup && ('''
)

# Fix Absence Review Modal
text = text.replace(
'''        </div>
    )
}

{/* ── Absence Review Modal ── */ }
{
    reviewingAbsence && (''',
'''                </div>
            )}

            {/* ── Absence Review Modal ── */}
            {reviewingAbsence && ('''
)

# Fix the trailing div
text = text.replace(
'''        </div>
    )
}
        </div >
    )
}''',
'''                </div>
            )}
        </div>
    )
}'''
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
