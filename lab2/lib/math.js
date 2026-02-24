'use strict';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function deg2rad(deg) {
    return (deg * Math.PI) / 180;
}

function rad2deg(rad) {
    return (rad * 180) / Math.PI;
}

function normalizeAngle(angle) {
    let a = angle;
    while (a > 180) a -= 360;
    while (a < -180) a += 360;
    return a;
}

function meanAngles(angles) {
    if (!angles || angles.length === 0) return 0;
    let x = 0;
    let y = 0;
    for (const angle of angles) {
        const rad = deg2rad(angle);
        x += Math.cos(rad);
        y += Math.sin(rad);
    }
    if (x === 0 && y === 0) {
        return normalizeAngle(angles[0]);
    }
    return normalizeAngle(rad2deg(Math.atan2(y, x)));
}

function lerpAngle(from, to, alpha) {
    const delta = normalizeAngle(to - from);
    return normalizeAngle(from + delta * alpha);
}

function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.hypot(dx, dy);
}

module.exports = {
    clamp,
    deg2rad,
    rad2deg,
    normalizeAngle,
    meanAngles,
    lerpAngle,
    distance,
};
