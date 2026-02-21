'use strict';

const { getPoint, hasPoint } = require('./flags');
const {
    deg2rad,
    rad2deg,
    normalizeAngle,
    meanAngles,
    lerpAngle,
    distance,
} = require('./math');

const FIELD_MARGIN_X = 7.5;
const FIELD_MARGIN_Y = 6.0;

function validReference(observation) {
    return (
        observation
        && observation.distance !== null
        && observation.direction !== null
        && hasPoint(observation.name)
    );
}

function toReferences(observations) {
    const refs = [];
    for (const obs of observations) {
        if (!validReference(obs)) continue;
        refs.push({
            obs,
            point: getPoint(obs.name),
            d: obs.distance,
            a: obs.direction,
        });
    }
    return refs;
}

function insidePlayableArea(candidate) {
    return (
        candidate.x >= -57.5 - FIELD_MARGIN_X
        && candidate.x <= 57.5 + FIELD_MARGIN_X
        && candidate.y >= -39 - FIELD_MARGIN_Y
        && candidate.y <= 39 + FIELD_MARGIN_Y
    );
}

function circleIntersections(c1, r1, c2, r2) {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.hypot(dx, dy);

    if (d === 0) return [];
    if (d > r1 + r2 + 1e-6) return [];
    if (d < Math.abs(r1 - r2) - 1e-6) return [];

    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    let h2 = r1 * r1 - a * a;
    if (h2 < -1e-4) return [];
    if (h2 < 0) h2 = 0;
    const h = Math.sqrt(h2);

    const xm = c1.x + (a * dx) / d;
    const ym = c1.y + (a * dy) / d;

    if (h === 0) {
        return [{ x: xm, y: ym }];
    }

    const rx = (-dy * h) / d;
    const ry = (dx * h) / d;
    return [
        { x: xm + rx, y: ym + ry },
        { x: xm - rx, y: ym - ry },
    ];
}

function fallbackLeastSquares(refs) {
    if (refs.length < 2) return null;

    const base = refs[0];
    let a11 = 0;
    let a12 = 0;
    let a22 = 0;
    let b1 = 0;
    let b2 = 0;

    for (let i = 1; i < refs.length; i += 1) {
        const r = refs[i];
        const ax = 2 * (r.point.x - base.point.x);
        const ay = 2 * (r.point.y - base.point.y);
        const b =
            r.point.x * r.point.x
            - base.point.x * base.point.x
            + r.point.y * r.point.y
            - base.point.y * base.point.y
            + base.d * base.d
            - r.d * r.d;

        a11 += ax * ax;
        a12 += ax * ay;
        a22 += ay * ay;
        b1 += ax * b;
        b2 += ay * b;
    }

    const det = a11 * a22 - a12 * a12;
    if (Math.abs(det) < 1e-6) return null;

    const x = (b1 * a22 - b2 * a12) / det;
    const y = (a11 * b2 - a12 * b1) / det;
    return { x, y };
}

function candidateError(candidate, refs) {
    let error = 0;
    for (const ref of refs) {
        const d = distance(candidate, ref.point);
        const e = d - ref.d;
        error += e * e;
    }
    return refs.length > 0 ? error / refs.length : Infinity;
}

function estimateBodyDir(position, refs) {
    const headings = [];
    for (const ref of refs) {
        const globalAngle = rad2deg(
            Math.atan2(ref.point.y - position.y, ref.point.x - position.x)
        );
        headings.push(normalizeAngle(globalAngle - ref.a));
    }
    return meanAngles(headings);
}

function estimatePoseFromFlags(observations, previousPose = null) {
    const refs = toReferences(observations);
    if (refs.length < 2) return null;

    const candidates = [];
    for (let i = 0; i < refs.length; i += 1) {
        for (let j = i + 1; j < refs.length; j += 1) {
            const first = refs[i];
            const second = refs[j];
            const points = circleIntersections(first.point, first.d, second.point, second.d);
            for (const point of points) {
                if (insidePlayableArea(point)) {
                    candidates.push(point);
                }
            }
        }
    }

    if (candidates.length === 0) {
        const ls = fallbackLeastSquares(refs);
        if (ls && insidePlayableArea(ls)) {
            candidates.push(ls);
        }
    }

    if (candidates.length === 0) return null;

    const scored = candidates.map((candidate) => ({
        candidate,
        error: candidateError(candidate, refs),
    }));

    scored.sort((a, b) => {
        if (a.error !== b.error) return a.error - b.error;
        if (a.candidate.x !== b.candidate.x) return a.candidate.x - b.candidate.x;
        return a.candidate.y - b.candidate.y;
    });

    let { candidate, error } = scored[0];
    let bodyDir = estimateBodyDir(candidate, refs);

    if (previousPose) {
        const alpha = error <= 0.5 ? 0.8 : 0.65;
        candidate = {
            x: previousPose.x * (1 - alpha) + candidate.x * alpha,
            y: previousPose.y * (1 - alpha) + candidate.y * alpha,
        };
        bodyDir = lerpAngle(previousPose.bodyDir, bodyDir, alpha);
        error = candidateError(candidate, refs);
    }

    return {
        x: candidate.x,
        y: candidate.y,
        bodyDir,
        error,
        references: refs.length,
    };
}

function globalObjectPosition(pose, observation) {
    if (!pose || !observation) return null;
    if (observation.distance === null || observation.direction === null) return null;

    const globalAngle = deg2rad(normalizeAngle(pose.bodyDir + observation.direction));
    return {
        x: pose.x + observation.distance * Math.cos(globalAngle),
        y: pose.y + observation.distance * Math.sin(globalAngle),
    };
}

module.exports = {
    estimatePoseFromFlags,
    globalObjectPosition,
};
